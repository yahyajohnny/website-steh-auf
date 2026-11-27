<?php
/**
 * Ticket-API-Keys (serverseitig) – nicht committen.
 *
 * 1. Diese Datei nach events.config.php kopieren
 * 2. Tokens aus Vivenu / Eventbrite eintragen
 */
return [
    'vivenuApiKey'       => 'key_…',
    'eventbriteToken'    => '…',
    /** Optional: nur Events dieser Vivenu-Seller-IDs (leer = alle außer Backstage). */
    'vivenuSellerIds'    => [],
    /**
     * false (Standard): alle zukünftigen Vivenu-Events außer „Backstage“.
     * true: nur Treffer mit „Steh auf“ / Open-Mic-Standortfilter.
     */
    'vivenuStrictFilter' => false,
    /** HTTP-Cache in Sekunden (Live: 300). */
    'cacheMaxAge'        => 300,
];
