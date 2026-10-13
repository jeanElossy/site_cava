import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import { CornerDownLeft, Search } from "lucide-react";

import { searchNav } from "../../../pages/admin/adminNav";

import "./QuickNav.scss";

/**
 * Recherche rapide des écrans de l'administration (Ctrl+K / ⌘K).
 *
 * Plus de trente entrées selon le rôle : les retrouver dans la barre
 * latérale oblige à la faire défiler. Ici, on tape trois lettres puis
 * Entrée. La liste ne propose QUE les entrées déjà visibles pour le
 * rôle (`groups` vient de `visibleNavGroups`) : elle ne révèle aucun
 * écran que le menu n'affiche pas.
 *
 * Motif « combobox » : le focus reste dans le champ, les flèches
 * déplacent la sélection (`aria-activedescendant`), Entrée ouvre,
 * Échap ferme.
 */
const QuickNav = ({ groups, onClose }) => {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const openerRef = useRef(null);

  const listId = useId();
  const optionId = (index) => `${listId}-option-${index}`;

  const results = useMemo(() => searchNav(query, groups), [query, groups]);

  // Sélection ramenée dans les bornes quand la liste rétrécit.
  const current = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    openerRef.current = document.activeElement;
    inputRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;

      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, []);

  // L'option sélectionnée reste visible quand on la déplace au clavier.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const open = (entry) => {
    if (!entry) return;

    onClose();
    navigate(entry.item.to);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(results.length ? (current + 1) % results.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(
        results.length ? (current - 1 + results.length) % results.length : 0
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      open(results[current]);
    }
  };

  return (
    <div className="admin-quicknav">
      <div
        className="admin-quicknav__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="admin-quicknav__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Aller à une page de l'administration"
      >
        <div className="admin-quicknav__field">
          <Search aria-hidden="true" />

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results.length ? optionId(current) : undefined}
            placeholder="Aller à… (dons, enfants, caisse…)"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
            maxLength={60}
          />

          <kbd>Échap</kbd>
        </div>

        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label="Pages"
          className="admin-quicknav__list"
        >
          {results.map((entry, index) => {
            const Icon = entry.item.icon;
            const selected = index === current;

            return (
              <li
                key={entry.item.to}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                data-index={index}
                className={
                  selected
                    ? "admin-quicknav__option admin-quicknav__option--active"
                    : "admin-quicknav__option"
                }
                // `onMouseDown` + preventDefault : le clic ne retire pas
                // le focus du champ avant la navigation.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => open(entry)}
                onMouseMove={() => !selected && setActive(index)}
              >
                <span className="admin-quicknav__icon">
                  <Icon aria-hidden="true" />
                </span>

                <span className="admin-quicknav__text">
                  <strong>{entry.item.label}</strong>
                  <span>{entry.group.title ?? "Général"}</span>
                </span>

                {selected && (
                  <CornerDownLeft
                    className="admin-quicknav__enter"
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ul>

        {results.length === 0 && (
          <p className="admin-quicknav__empty">
            Aucune page ne correspond à « {query} ».
          </p>
        )}

        <footer className="admin-quicknav__foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> pour choisir
          </span>
          <span>
            <kbd>Entrée</kbd> pour ouvrir
          </span>
        </footer>
      </div>
    </div>
  );
};

export default QuickNav;
