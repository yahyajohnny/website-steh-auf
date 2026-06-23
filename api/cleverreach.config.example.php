<?php
/**
 * CleverReach API – Konfiguration
 *
 * 1. Diese Datei nach cleverreach.config.php kopieren
 * 2. Werte aus CleverReach eintragen (Account → Extras → REST-API)
 * 3. list_id = Empfängerliste, form_id = Anmeldeformular (für Double-Opt-In-Mail)
 */
return [
    'client_id'     => 'DEINE_CLIENT_ID',
    'client_secret' => 'DEIN_CLIENT_SECRET',
    'list_id'       => 0,
    // Numerische Formular-ID für REST-API (Formulare → klassisches Formular)
    'form_id'       => 0,
    // Optional: UUID des Beta-Formulars (nur Referenz, nicht für API)
    'flow_id'       => '',
];
