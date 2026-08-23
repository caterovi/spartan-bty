import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ArrowRight,
  Clock3,
  LoaderCircle,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router-dom';

import api from '../api/axiosInstance';
import {
  colors,
  font,
} from '../styles/tokens';

import Customer360Modal from './Customer360Modal';

const MIN_QUERY_LENGTH = 2;

function formatLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const requestSequence = useRef(0);

  const [open, setOpen] =
    useState(false);
  const [query, setQuery] =
    useState('');
  const [groups, setGroups] =
    useState([]);
  const [quickActions, setQuickActions] =
    useState([]);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState('');
  const [customerId, setCustomerId] =
    useState(null);

  useEffect(() => {
    let active = true;

    async function loadQuickActions() {
      try {
        const response = await api.get(
          '/search'
        );

        if (active) {
          setQuickActions(
            response.data.quickActions || []
          );
        }
      } catch {
        // The palette still remains usable. A query
        // request will surface any actionable error.
      }
    }

    loadQuickActions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleShortcut(event) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setOpen(true);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener(
      'keydown',
      handleShortcut
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleShortcut
      );
    };
  }, []);

  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() =>
        inputRef.current?.focus()
      );
    }
  }, [open]);

  useEffect(() => {
    const cleanedQuery = query.trim();

    if (
      cleanedQuery.length < MIN_QUERY_LENGTH
    ) {
      requestSequence.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroups([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    const sequence =
      requestSequence.current + 1;
    requestSequence.current = sequence;

    const timeoutId = window.setTimeout(
      async () => {
        setLoading(true);
        setError('');

        try {
          const response = await api.get(
            '/search',
            {
              params: {
                q: cleanedQuery,
              },
            }
          );

          if (
            requestSequence.current !==
            sequence
          ) {
            return;
          }

          setGroups(
            response.data.groups || []
          );
          setQuickActions(
            response.data.quickActions || []
          );
        } catch (requestError) {
          if (
            requestSequence.current !==
            sequence
          ) {
            return;
          }

          setGroups([]);
          setError(
            requestError.response?.data
              ?.message ||
              'Unable to complete the search.'
          );
        } finally {
          if (
            requestSequence.current ===
            sequence
          ) {
            setLoading(false);
          }
        }
      },
      280
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const closePalette = () => {
    setOpen(false);
  };

  const openResult = (result) => {
    if (result.type === 'customer') {
      setCustomerId(result.referenceId);
      closePalette();
      return;
    }

    if (!result.path) return;

    navigate(result.path, {
      state: {
        ...(result.navigationState || {}),
        globalSearchQuery: query.trim(),
        globalSearchType: result.type,
        referenceId: result.referenceId,
      },
    });

    closePalette();
  };

  const openQuickAction = (quickAction) => {
    navigate(quickAction.path, {
      state: {
        ...(quickAction.navigationState || {}),
        source: 'global-quick-action',
      },
    });

    closePalette();
  };

  const hasResults = groups.some(
    (group) =>
      group.results?.length > 0
  );

  const hasSearchQuery =
    query.trim().length >=
    MIN_QUERY_LENGTH;

  return (
    <>
      <style>{globalSearchStyles}</style>

      <button
        type="button"
        className="global-search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open global search"
        aria-haspopup="dialog"
      >
        <Search size={15} />

        <span className="global-search-trigger-text">
          Search orders, customers, products...
        </span>

        <kbd>Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="global-search-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePalette();
            }
          }}
        >
          <section
            className="global-search-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Global search and quick actions"
          >
            <div className="global-search-input-row">
              {loading ? (
                <LoaderCircle
                  className="global-search-spinner"
                  size={18}
                />
              ) : (
                <Search size={18} />
              )}

              <input
                ref={inputRef}
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Search authorized records..."
                aria-label="Search authorized records"
              />

              {query && (
                <button
                  type="button"
                  className="global-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}

              <button
                type="button"
                className="global-search-close"
                onClick={closePalette}
                aria-label="Close global search"
              >
                Esc
              </button>
            </div>

            <div className="global-search-scroll">
              {error && (
                <div
                  className="global-search-state global-search-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {!error &&
                hasSearchQuery &&
                !loading &&
                !hasResults && (
                  <div className="global-search-state">
                    No authorized records match
                    “{query.trim()}”.
                  </div>
                )}

              {!error &&
                !hasSearchQuery && (
                  <div className="global-search-hint">
                    Enter at least two characters.
                    Exact references, SKUs, and
                    contact numbers appear first.
                  </div>
                )}

              {!error &&
                groups.map((group) => (
                  <div
                    className="global-search-group"
                    key={group.category}
                  >
                    <p className="global-search-group-title">
                      {group.category}
                    </p>

                    <div>
                      {group.results.map(
                        (result) => (
                          <button
                            type="button"
                            className="global-search-result"
                            key={`${result.type}-${result.id}`}
                            onClick={() =>
                              openResult(result)
                            }
                          >
                            <span className="global-search-result-main">
                              <strong>
                                {result.title}
                              </strong>

                              <small>
                                {result.subtitle}
                              </small>

                              {result.workflow?.nextAction && (
                                <small className="global-search-next-action">
                                  Next: {result.workflow.nextAction}
                                </small>
                              )}
                            </span>

                            <span className="global-search-result-side">
                              <span className="global-search-module">
                                {result.module}
                              </span>

                              {result.status && (
                                <span className="global-search-status">
                                  {formatLabel(result.status)}
                                </span>
                              )}

                              <ArrowRight size={14} />
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}

              {quickActions.length > 0 && (
                <div className="global-search-actions">
                  <p className="global-search-group-title">
                    <Sparkles size={12} />
                    Quick Actions
                  </p>

                  <div className="global-search-action-grid">
                    {quickActions.map(
                      (quickAction) => (
                        <button
                          type="button"
                          key={`${quickAction.path}-${quickAction.label}`}
                          onClick={() =>
                            openQuickAction(
                              quickAction
                            )
                          }
                        >
                          <Clock3 size={14} />
                          <span>
                            {quickAction.label}
                          </span>
                          <ArrowRight size={13} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {customerId && (
        <Customer360Modal
          customerId={customerId}
          onClose={() =>
            setCustomerId(null)
          }
        />
      )}
    </>
  );
}

const globalSearchStyles = `
  .global-search-trigger {
    display: flex;
    align-items: center;
    width: min(390px, 34vw);
    min-width: 210px;
    gap: 9px;
    padding: 10px 11px;
    border: 1px solid ${colors.border};
    border-radius: 10px;
    background: ${colors.cream};
    color: ${colors.mutedInk};
    font-family: ${font.body};
    cursor: pointer;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .global-search-trigger:hover,
  .global-search-trigger:focus-visible {
    border-color: ${colors.rose};
    box-shadow: 0 0 0 3px ${colors.blush};
    outline: none;
  }

  .global-search-trigger-text {
    flex: 1;
    overflow: hidden;
    font-size: 10px;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .global-search-trigger kbd {
    padding: 3px 6px;
    border: 1px solid ${colors.border};
    border-radius: 5px;
    background: #ffffff;
    color: ${colors.mutedInk};
    font-family: ${font.body};
    font-size: 8px;
  }

  .global-search-overlay {
    position: fixed;
    inset: 0;
    z-index: 170;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 9vh 20px 20px;
    background: rgba(28, 22, 24, 0.55);
  }

  .global-search-palette {
    width: min(680px, 100%);
    overflow: hidden;
    border: 1px solid ${colors.border};
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 28px 80px rgba(25, 18, 20, 0.24);
    font-family: ${font.body};
  }

  .global-search-input-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 60px;
    padding: 10px 14px;
    border-bottom: 1px solid ${colors.border};
    color: ${colors.roseDeep};
  }

  .global-search-input-row input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: ${colors.ink};
    font-family: ${font.body};
    font-size: 14px;
  }

  .global-search-clear,
  .global-search-close {
    border: 1px solid ${colors.border};
    border-radius: 7px;
    background: ${colors.cream};
    color: ${colors.mutedInk};
    cursor: pointer;
  }

  .global-search-clear {
    display: grid;
    place-items: center;
    padding: 6px;
  }

  .global-search-close {
    padding: 6px 8px;
    font-family: ${font.body};
    font-size: 9px;
  }

  .global-search-spinner {
    animation: global-search-spin 800ms linear infinite;
  }

  .global-search-scroll {
    max-height: min(72vh, 650px);
    overflow-y: auto;
    padding: 9px 10px 12px;
  }

  .global-search-hint,
  .global-search-state {
    padding: 18px 13px;
    color: ${colors.mutedInk};
    font-size: 10px;
    line-height: 1.6;
    text-align: center;
  }

  .global-search-error {
    color: #9d344e;
  }

  .global-search-group {
    margin-top: 7px;
  }

  .global-search-group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 8px 9px 5px;
    color: ${colors.roseDeep};
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 1.1px;
    text-transform: uppercase;
  }

  .global-search-result {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 14px;
    padding: 10px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: ${colors.ink};
    font-family: ${font.body};
    text-align: left;
    cursor: pointer;
  }

  .global-search-result:hover,
  .global-search-result:focus-visible {
    background: ${colors.blush};
    outline: none;
  }

  .global-search-result-main {
    flex: 1;
    min-width: 0;
  }

  .global-search-result-main strong,
  .global-search-result-main small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .global-search-result-main strong {
    font-size: 11px;
  }

  .global-search-result-main small {
    margin-top: 3px;
    color: ${colors.mutedInk};
    font-size: 9px;
  }

  .global-search-next-action {
    color: ${colors.roseDeep} !important;
  }

  .global-search-result-side {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .global-search-module,
  .global-search-status {
    padding: 4px 7px;
    border-radius: 999px;
    font-size: 8px;
    white-space: nowrap;
  }

  .global-search-module {
    background: ${colors.blush};
    color: ${colors.roseDeep};
    font-weight: 700;
  }

  .global-search-status {
    border: 1px solid ${colors.border};
    color: ${colors.mutedInk};
  }

  .global-search-actions {
    margin-top: 9px;
    padding-top: 7px;
    border-top: 1px solid ${colors.border};
  }

  .global-search-action-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
    padding: 5px 8px;
  }

  .global-search-action-grid button {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 10px;
    border: 1px solid ${colors.border};
    border-radius: 9px;
    background: ${colors.cream};
    color: ${colors.ink};
    font-family: ${font.body};
    font-size: 9px;
    cursor: pointer;
  }

  .global-search-action-grid button:hover,
  .global-search-action-grid button:focus-visible {
    border-color: ${colors.rose};
    outline: none;
  }

  .global-search-action-grid span {
    flex: 1;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @keyframes global-search-spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 760px) {
    .global-search-trigger {
      width: 40px;
      min-width: 40px;
      height: 40px;
      justify-content: center;
      padding: 0;
    }

    .global-search-trigger-text,
    .global-search-trigger kbd {
      display: none;
    }

    .global-search-overlay {
      padding: 16px 12px;
    }

    .global-search-palette {
      border-radius: 13px;
    }

    .global-search-scroll {
      max-height: calc(100vh - 104px);
    }

    .global-search-result-side {
      max-width: 42%;
    }

    .global-search-status {
      display: none;
    }
  }

  @media (max-width: 460px) {
    .global-search-action-grid {
      grid-template-columns: 1fr;
    }

    .global-search-module {
      display: none;
    }
  }
`;
