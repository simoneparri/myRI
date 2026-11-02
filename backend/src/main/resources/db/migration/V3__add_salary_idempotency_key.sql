ALTER TABLE salary
    ADD COLUMN request_key VARCHAR(100) NULL,
    ADD CONSTRAINT uq_salary_request_key UNIQUE (request_key);
