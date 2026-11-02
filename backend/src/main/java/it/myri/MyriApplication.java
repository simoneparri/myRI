package it.myri;

import java.util.Arrays;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class MyriApplication {
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(MyriApplication.class);
        if (Arrays.asList(args).contains("--myri.reset-password=true")) {
            app.setWebApplicationType(WebApplicationType.NONE);
            System.exit(SpringApplication.exit(app.run(args)));
        } else {
            app.run(args);
        }
    }
}
