import { describe, it, before, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import webpush from "web-push";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import User from "../models/User.js";
import PushSubscription from "../models/PushSubscription.js";
import * as pushService from "./push.service.js";

const EMAIL_SUFFIX = "@example.invalid";
const EMAIL_PREFIX = "push.testsuite";

let soaUser;
let canaUser;

const fakeSubscription = (suffix) => ({
  endpoint: `https://push.example.invalid/${EMAIL_PREFIX}-${suffix}`,
  keys: { p256dh: `p256dh-${suffix}`, auth: `auth-${suffix}` },
});

describe("push.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();

    await User.deleteMany({ email: { $regex: `${EMAIL_PREFIX}.*${EMAIL_SUFFIX}$` } });

    soaUser = await User.create({
      name: "Agent SOA Push Test",
      email: `${EMAIL_PREFIX}.soa${EMAIL_SUFFIX}`,
      registrationNumber: "5AA00401A",
      password: "MotDePasseTemporaire123!",
      role: "soa",
    });
    canaUser = await User.create({
      name: "Agent CANA Push Test",
      email: `${EMAIL_PREFIX}.cana${EMAIL_SUFFIX}`,
      registrationNumber: "5AA00402A",
      password: "MotDePasseTemporaire123!",
      role: "cana",
    });
  });

  afterEach(async () => {
    mock.restoreAll();
    await PushSubscription.deleteMany({ user: { $in: [soaUser._id, canaUser._id] } });
  });

  after(async () => {
    await User.deleteMany({ _id: { $in: [soaUser._id, canaUser._id] } });
    await disconnectTestDb();
  });

  it("enregistre puis retire un abonnement, en remplaçant un abonnement existant pour le même endpoint", async () => {
    const subscription = fakeSubscription("subscribe");

    await pushService.subscribe(soaUser._id, subscription);
    const first = await PushSubscription.findOne({ endpoint: subscription.endpoint }).lean();
    assert.equal(String(first.user), String(soaUser._id));

    // Même endpoint, ré-abonné par un autre compte (même appareil,
    // session différente) : remplace plutôt que de dupliquer.
    await pushService.subscribe(canaUser._id, subscription);
    const afterResubscribe = await PushSubscription.find({ endpoint: subscription.endpoint }).lean();
    assert.equal(afterResubscribe.length, 1);
    assert.equal(String(afterResubscribe[0].user), String(canaUser._id));

    await pushService.unsubscribe(canaUser._id, subscription.endpoint);
    const afterUnsubscribe = await PushSubscription.findOne({ endpoint: subscription.endpoint });
    assert.equal(afterUnsubscribe, null);
  });

  it("refuse un abonnement incomplet", async () => {
    await assert.rejects(
      () => pushService.subscribe(soaUser._id, { endpoint: "https://push.example.invalid/x" }),
      /invalide/
    );
  });

  it("sendToUser envoie une notification à chaque appareil abonné", async () => {
    await pushService.subscribe(soaUser._id, fakeSubscription("device-a"));
    await pushService.subscribe(soaUser._id, fakeSubscription("device-b"));

    const sendNotification = mock.method(webpush, "sendNotification", async () => {});

    await pushService.sendToUser(soaUser._id, { title: "Test", body: "Contenu" });

    assert.equal(sendNotification.mock.callCount(), 2);

    const [, payload] = sendNotification.mock.calls[0].arguments;
    assert.deepEqual(JSON.parse(payload), { title: "Test", body: "Contenu" });
  });

  it("supprime un abonnement expiré (410) sans faire échouer l'envoi", async () => {
    await pushService.subscribe(soaUser._id, fakeSubscription("expired"));

    mock.method(webpush, "sendNotification", async () => {
      const error = new Error("gone");
      error.statusCode = 410;
      throw error;
    });

    await pushService.sendToUser(soaUser._id, { title: "Test" });

    const remaining = await PushSubscription.find({ user: soaUser._id }).lean();
    assert.equal(remaining.length, 0);
  });

  it("garde un abonnement quand l'échec n'est pas une expiration", async () => {
    await pushService.subscribe(soaUser._id, fakeSubscription("network-error"));

    mock.method(webpush, "sendNotification", async () => {
      throw new Error("Panne réseau temporaire");
    });

    await pushService.sendToUser(soaUser._id, { title: "Test" });

    const remaining = await PushSubscription.find({ user: soaUser._id }).lean();
    assert.equal(remaining.length, 1);
  });

  it("sendToRoles n'envoie qu'aux comptes actifs des rôles demandés", async () => {
    await pushService.subscribe(soaUser._id, fakeSubscription("role-soa"));
    await pushService.subscribe(canaUser._id, fakeSubscription("role-cana"));

    const sendNotification = mock.method(webpush, "sendNotification", async () => {});

    await pushService.sendToRoles(["soa"], { title: "Nouveau dossier" });

    // `sendToRoles` interroge TOUS les comptes actifs du rôle demandé,
    // dans toute la base — pas seulement ceux créés par ce test. Sur
    // la base MongoDB partagée de développement (voir test/db.js),
    // d'autres fichiers de test tournant en parallèle peuvent, à cet
    // instant précis, avoir eux aussi un compte "soa" activement
    // abonné (voir newSoul.service.test.js, qui abonne puis désabonne
    // un compte SOA le temps d'un test). D'où des assertions ciblées
    // sur NOS DEUX endpoints plutôt qu'un `callCount()` exact.
    const notifiedEndpoints = sendNotification.mock.calls.map(
      (call) => call.arguments[0].endpoint
    );
    assert.ok(notifiedEndpoints.includes(fakeSubscription("role-soa").endpoint));
    assert.ok(!notifiedEndpoints.includes(fakeSubscription("role-cana").endpoint));
  });
});
