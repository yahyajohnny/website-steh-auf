/**
 * Öffentliche Frontend-Config (keine Secrets).
 * Ticket-API-Keys liegen serverseitig in api/events.config.php.
 */
window.STEH_AUF_CONFIG = {
  eventsApiUrl: 'api/events.php',
  cleverReach: {
    apiUrl: 'api/newsletter.php',
    formAction: '',
    hiddenFields: {}
  }
};
