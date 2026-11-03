package mz.agua.service;

import mz.agua.security.Plans;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Planos (Básico / Standard / Enterprise) e montagem das mensagens WhatsApp/SMS. */
class MessagesTest {

    @Test
    void plans() {
        assertThat(Plans.whatsapp("basic")).isFalse();
        assertThat(Plans.sms("basic")).isFalse();
        assertThat(Plans.whatsapp("standard")).isTrue();
        assertThat(Plans.sms("standard")).isFalse();
        assertThat(Plans.whatsapp("enterprise")).isTrue();
        assertThat(Plans.sms("enterprise")).isTrue();
        assertThatThrownBy(() -> Plans.require("standard", "sms")).hasMessageContaining("Enterprise");
        assertThatThrownBy(() -> Plans.require("basic", "whatsapp")).hasMessageContaining("Standard");
    }

    @Test
    void channelsLimitedByPlan() {
        assertThat(MessageService.channels("enterprise", "both")).containsExactly("whatsapp", "sms");
        assertThat(MessageService.channels("standard", "both")).containsExactly("whatsapp");
        assertThat(MessageService.channels("standard", "sms")).containsExactly("whatsapp");
        assertThat(MessageService.channels("basic", "whatsapp")).isEmpty();
    }

    @Test
    void renderTemplate() {
        String out = MessageService.render("Olá {cliente}. Deve {divida} {desconhecido}{ fim", Map.of("cliente", "Ana", "divida", "1 200,00 MZN"));
        assertThat(out).isEqualTo("Olá Ana. Deve 1 200,00 MZN { fim");
    }

    @Test
    void phonesAndLinks() {
        assertThat(MessageGateway.international("84 123 4567")).isEqualTo("258841234567");
        assertThat(MessageGateway.international("+258 84 123 4567")).isEqualTo("258841234567");
        assertThat(MessageService.link("whatsapp", "841234567", "Olá Ana")).isEqualTo("https://wa.me/258841234567?text=Ol%C3%A1%20Ana");
        assertThat(MessageService.link("sms", "841234567", "Olá")).startsWith("sms:+258841234567?body=");
    }
}
