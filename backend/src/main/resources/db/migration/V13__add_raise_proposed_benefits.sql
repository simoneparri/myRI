ALTER TABLE raise_request
    ADD COLUMN benefits_specified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN meal_vouchers BOOLEAN NULL,
    ADD COLUMN bonus_letter_amount DECIMAL(12,2) NULL,
    ADD COLUMN company_car BOOLEAN NULL,
    ADD CONSTRAINT ck_raise_benefits_specified CHECK (benefits_specified IN (0, 1)),
    ADD CONSTRAINT ck_raise_meal_vouchers CHECK (meal_vouchers IN (0, 1)),
    ADD CONSTRAINT ck_raise_bonus_letter_amount CHECK (bonus_letter_amount >= 0),
    ADD CONSTRAINT ck_raise_company_car CHECK (company_car IN (0, 1)),
    ADD CONSTRAINT ck_raise_unspecified_benefits CHECK (
        benefits_specified = 1 OR
        (meal_vouchers IS NULL AND bonus_letter_amount IS NULL AND company_car IS NULL)
    );
