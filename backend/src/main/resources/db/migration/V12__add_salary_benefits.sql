ALTER TABLE salary
    ADD COLUMN meal_vouchers BOOLEAN NULL,
    ADD COLUMN bonus_letter_amount DECIMAL(12,2) NULL,
    ADD COLUMN company_car BOOLEAN NULL,
    ADD CONSTRAINT ck_salary_meal_vouchers CHECK (meal_vouchers IN (0, 1)),
    ADD CONSTRAINT ck_salary_bonus_letter_amount CHECK (bonus_letter_amount >= 0),
    ADD CONSTRAINT ck_salary_company_car CHECK (company_car IN (0, 1));
