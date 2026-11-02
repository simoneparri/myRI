package it.myri.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@org.springframework.core.annotation.Order(0)
public class AccountBootstrap implements ApplicationRunner {
    private final AccountService accounts;
    private final String username;
    private final String password;
    private final boolean reset;
    private final String resetPassword;

    public AccountBootstrap(AccountService accounts,
            @Value("${myri.bootstrap.username}") String username,
            @Value("${myri.bootstrap.password}") String password,
            @Value("${myri.reset-password}") boolean reset,
            @Value("${myri.reset-password-value}") String resetPassword) {
        this.accounts = accounts;
        this.username = username;
        this.password = password;
        this.reset = reset;
        this.resetPassword = resetPassword;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        if (reset) {
            accounts.reset(resetPassword);
        } else {
            accounts.bootstrap(username, password);
        }
    }
}
