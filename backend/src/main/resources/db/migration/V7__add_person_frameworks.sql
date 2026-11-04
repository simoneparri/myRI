ALTER TABLE person
    ADD COLUMN frameworks JSON NOT NULL DEFAULT (JSON_ARRAY()),
    ADD CONSTRAINT ck_person_frameworks CHECK (
        JSON_TYPE(frameworks) = 'ARRAY' AND JSON_LENGTH(frameworks) <= 50
    );
