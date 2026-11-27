/**
 * Vorlage für öffentliche Frontend-Config.
 * Secrets gehören nach api/events.config.php (nicht hier).
 * Client-Keys (vivenuApiKey / eventbriteToken) nur als lokaler Fallback.
 */
window.STEH_AUF_CONFIG = {
  eventsApiUrl: 'api/events.php',
  // Optionaler Fallback, wenn die PHP-API lokal nicht läuft:
  // vivenuApiKey: '',
  // eventbriteToken: '',
  // vivenuSellerIds: [],
  // vivenuStrictFilter: false,
  cleverReach: {
    apiUrl: 'api/newsletter.php',
    formAction: '',
    hiddenFields: {}
  }
};
