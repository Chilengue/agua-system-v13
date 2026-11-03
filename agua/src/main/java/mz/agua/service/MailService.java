package mz.agua.service;

import lombok.extern.slf4j.Slf4j;
import mz.agua.config.AppProperties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Envio de emails. Só funciona se spring.mail.host estiver configurado (.env: MAIL_HOST…);
 * sem isso o sistema continua a funcionar e os pedidos de senha vão para o administrador.
 */
@Slf4j
@Service
public class MailService {

    private final ObjectProvider<JavaMailSender> sender;
    private final AppProperties props;
    private final String host;

    public MailService(ObjectProvider<JavaMailSender> sender, AppProperties props,
                       @Value("${spring.mail.host:}") String host) {
        this.sender = sender;
        this.props = props;
        this.host = host;
    }

    public boolean enabled() {
        return host != null && !host.isBlank() && sender.getIfAvailable() != null;
    }

    public boolean send(String to, String subject, String text) {
        if (!enabled()) return false;
        JavaMailSender s = sender.getIfAvailable();
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            if (props.mailFrom() != null && !props.mailFrom().isBlank()) m.setFrom(props.mailFrom());
            m.setTo(to);
            m.setSubject(subject);
            m.setText(text);
            s.send(m);
            return true;
        } catch (RuntimeException e) {
            log.warn("Falha ao enviar email para {}: {}", to, e.getMessage());
            return false;
        }
    }
}
