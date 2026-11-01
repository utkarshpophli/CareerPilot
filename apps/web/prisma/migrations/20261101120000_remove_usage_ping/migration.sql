-- The usage ping was removed: delete the settings it left behind (install ID, last day, consent).
DELETE FROM "Setting" WHERE key LIKE 'usagePing%';
