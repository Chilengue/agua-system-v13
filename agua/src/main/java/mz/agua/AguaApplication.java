package mz.agua;

import org.springframework.boot.SpringApplication;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
public class AguaApplication {

    public static void main(String[] args) {
        System.setProperty("agua.project.dir", projectDir());
        SpringApplication.run(AguaApplication.class, args);
    }

    /**
     * Pasta do projeto (onde está o pom.xml e o .env), mesmo que o programa seja arrancado
     * a partir de outra pasta: .../agua/target/classes → .../agua ; .../agua/target/x.jar → .../agua
     */
    static String projectDir() {
        try {
            Path p = Paths.get(AguaApplication.class.getProtectionDomain().getCodeSource().getLocation().toURI());
            for (int i = 0; i < 4 && p != null; i++) {
                if (Files.exists(p.resolve("pom.xml")) || Files.exists(p.resolve(".env"))) return p.toString();
                p = p.getParent();
            }
        } catch (Exception ignored) {
            // corre a partir de um jar dentro de outro jar ou sem acesso ao disco: usa a pasta atual
        }
        return ".";
    }
}
