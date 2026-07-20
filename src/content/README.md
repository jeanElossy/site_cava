# Contenu généré

Ces fichiers JSON sont **générés automatiquement** par
`scripts/fetch-content.mjs`, qui interroge l'API au moment du build.

## Pourquoi ils sont versionnés

Ils sont commités volontairement, pour deux raisons :

1. **Le déploiement fonctionne sans l'API.** Tant que l'API n'est pas
   hébergée — ou si elle est momentanément indisponible — le site se
   construit avec le dernier contenu généré au lieu d'échouer.
2. **L'historique du contenu est traçable.** Un `git diff` montre ce
   qui a changé sur le site entre deux publications.

## Ne pas les modifier à la main

Toute modification directe sera écrasée à la prochaine génération.
Le contenu se modifie depuis l'espace d'administration, puis se
publie avec le bouton « Publier ».

## Régénérer localement

```bash
npm run content   # nécessite l'API démarrée (backend/npm run dev)
```
