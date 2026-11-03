package mz.agua.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mz.agua.common.Resp;
import mz.agua.dto.Dto;
import mz.agua.security.CurrentUser;
import mz.agua.service.MessageService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Mensagens WhatsApp/SMS do gestor (/api/messages). O plano da empresa é confirmado em MessageService. */
@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messages;

    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                    @RequestParam(required = false) String channel, @RequestParam(required = false) String kind,
                                    @RequestParam(required = false) String from, @RequestParam(required = false) String to,
                                    @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return messages.list(CurrentUser.manager(), q, status, channel, kind, from, to, page, size);
    }

    /** Aviso de fatura: channel = whatsapp | sms. Sem API devolve o link para abrir no telemóvel. */
    @PostMapping("/invoice/{id}")
    public Map<String, Object> invoice(@PathVariable Long id, @RequestParam(defaultValue = "whatsapp") String channel) {
        return Resp.ok("message", messages.forInvoice(CurrentUser.manager(), id, channel));
    }

    /** Recibo de pagamento por WhatsApp/SMS. */
    @PostMapping("/payment/{id}")
    public Map<String, Object> payment(@PathVariable Long id, @RequestParam(defaultValue = "whatsapp") String channel) {
        return Resp.ok("message", messages.forPayment(CurrentUser.manager(), id, channel));
    }

    /** Lembretes a devedores ou mensagem livre a vários clientes. */
    @PostMapping("/bulk")
    public Map<String, Object> bulk(@Valid @RequestBody Dto.MessageSend body) {
        return Resp.ok().withAll(messages.bulk(CurrentUser.manager(), body)).build();
    }

    @PostMapping("/{id}/opened")
    public Map<String, Object> opened(@PathVariable Long id) {
        messages.opened(CurrentUser.manager(), id);
        return Resp.message("Mensagem marcada como enviada.");
    }

    @PostMapping("/{id}/retry")
    public Map<String, Object> retry(@PathVariable Long id) {
        return Resp.ok("message", messages.retry(CurrentUser.manager(), id));
    }

    @PostMapping("/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable Long id) {
        messages.cancel(CurrentUser.manager(), id);
        return Resp.message("Mensagem cancelada.");
    }
}
