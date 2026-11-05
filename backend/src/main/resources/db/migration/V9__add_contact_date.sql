ALTER TABLE contact
    ADD COLUMN contacted_on DATE NULL,
    ADD INDEX ix_contact_person_contacted_on (person_id, contacted_on DESC, id);
