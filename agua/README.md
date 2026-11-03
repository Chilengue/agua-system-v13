# AguaSystem v13

Sistema **multi-empresa** de gestão e faturação de água: clientes com várias contas, leituras no terreno
(também **sem internet**), tarifas de cada provedor, faturas, **pagamentos aos poucos**, recibos editáveis,
extratos, relatórios e painel de administração. **Novo na v13:** planos de negócio (Básico, Standard, Enterprise),
avisos e recibos por **WhatsApp** e **SMS**, valor a pagar calculado enquanto se escreve a leitura, recibo em PDF para o cliente.

**Stack:** Java 17+ · Spring Boot 3.3 (Web, Data JPA, JDBC, Security, **Validation**, **Mail**, Actuator, DevTools)
· **Lombok** · PostgreSQL · Flyway · HTML/CSS/JS (PWA, sem frameworks).

---

## 1. Instalar e arrancar (PostgreSQL instalado, sem Docker)

**Requisitos:** Java 17 ou superior, Maven 3.9+, PostgreSQL 14+.

1. Crie a base de dados (uma vez). **Vem da v12? Não apague nada:** ao arrancar, o Flyway aplica a migração
   `V2__plans_messages.sql` e todos os dados mantêm-se (as empresas ficam no plano Básico). Só uma base da v11 tem de ser apagada.
   ```sql
   DROP DATABASE IF EXISTS agua_system;
   CREATE DATABASE agua_system;
   ```
2. Copie `.env.example` para `.env` **na pasta que tem o `pom.xml`** e ponha a senha do PostgreSQL:
   ```
   DB_USER=postgres
   DB_PASSWORD=a_sua_senha
   DB_NAME=agua_system
   ```
   Confirme a senha com `psql -U postgres -h localhost -d agua_system`.
3. Compile e arranque:
   ```bash
   mvn clean package -DskipTests
   java -jar target/agua-system-13.0.0.jar
   ```
   (ou `mvn spring-boot:run`, ou o botão ▶ do VS Code/IntelliJ — abra a pasta que tem o `pom.xml`).
4. Abra **http://localhost:8080**. Na primeira vez aparece a página para criar o **Administrador**.

As tabelas são criadas pelo Flyway (`src/main/resources/db/migration/V1__schema.sql`).
No log deve aparecer `Successfully applied … migration` (base nova: 2; vinda da v12: 1) e `Tomcat started on port 8080`.

**Erros comuns**
| Mensagem | Solução |
|---|---|
| `password authentication failed for user "postgres"` | A senha no `.env` está errada ou o `.env` não está ao lado do `pom.xml`. |
| `database "agua_system" does not exist` | Faça o passo 1. |
| `Port 8080 was already in use` | Ponha `PORT=8081` no `.env` ou feche o outro programa. |
| `Validate failed: Migrations have failed validation` | A base é da v11: apague e crie de novo (passo 1). |

---

## 2. Perfis

| Perfil | Login | O que faz |
|---|---|---|
| **Administrador** | criado na instalação | Painel com gráficos de uso e receitas · empresas (aprovar, suspender) · **planos de cada empresa** e clientes em cada plano · **gestores** (corrigir nome/email, bloquear, nova senha) · clientes de todas as empresas com histórico de pagamentos · pagamentos · devedores · relatórios · pedidos de senha dos gestores · auditoria. **Não vê nem altera utilizadores de mediadores ou de clientes.** |
| **Gestor** | código da empresa, ex.: `AGUA-VJA3-VGRA` (ou o email) | Tudo da sua empresa: clientes, leituras, faturas, caixa, extratos, devedores, relatórios, tarifas, recibo · **Utilizadores**: mediadores (criar, bloquear, nova senha, apagar), acessos dos clientes ao portal (bloquear, nova senha, remover) e pedidos de senha · **Mensagens** (planos Standard/Enterprise) |
| **Mediador** | `MED-VJA3-01` | Leituras no telemóvel, com ou sem internet, vendo logo o valor a pagar |
| **Cliente** | `CLI-VJA3-00001` | Contas, faturas, **recibos (ver, imprimir, baixar PDF)**, consumo e extrato |

Todas as contas novas recebem uma **senha temporária** e o utilizador é **obrigado a mudá-la** no primeiro acesso.

### Login
- **Registar empresa:** o provedor regista-se no login; o sistema gera o código (utilizador) e a senha
  temporária e **descarrega um PDF** com os dados e os termos. A empresa fica pendente até o administrador aprovar
  (`AUTO_APPROVE_COMPANIES=true` para ativar logo).
- **Recuperar senha:** pede o **email e o nome completo** usados no registo. Com email configurado (`MAIL_HOST`)
  chega um código de 6 dígitos; sem email, o pedido aparece ao administrador em *Recuperar senhas*.
- **O email é único** em todo o sistema. Utilizadores sem email aparecem no painel do admin para completar.
- O contacto de suporte (`SUPPORT_PHONE`, `SUPPORT_NAME`) aparece por baixo do login.

---

## 3. Planos de negócio e mensagens

| Plano | O que inclui |
|---|---|
| **Básico** | Faturação, leituras (também sem internet), caixa, extratos, relatórios e portal do cliente. Sem WhatsApp e sem SMS — o menu *Mensagens* nem aparece. |
| **Standard** | Tudo do Básico + **WhatsApp**: aviso da fatura emitida, recibo do pagamento, lembretes a devedores e mensagens livres. |
| **Enterprise** | Tudo do Standard + **SMS**. |

- O **administrador** escolhe o plano ao criar a empresa e muda-o em *Planos* (ou na ficha da empresa). Empresas registadas
  no login começam no Básico. Ao descer de plano o módulo desaparece logo e os envios automáticos são desligados.
- Cada **empresa** indica em *Empresa e recibo → Mensagens* o **número de WhatsApp** que envia as mensagens de pagamentos e
  (Enterprise) o **número/remetente de SMS**, se quer avisar automaticamente quando a fatura é emitida e/ou quando o
  cliente paga, e os modelos das mensagens (`{cliente}`, `{fatura}`, `{valor}`, `{divida}`, `{recibo}`…).
- **Como as mensagens saem:**
  - *Abrir no telemóvel* (padrão, sem custos): o WhatsApp/SMS do operador abre com o texto pronto; as automáticas ficam em
    *Mensagens → Por abrir*.
  - *Automático por API*: WhatsApp Cloud API (Meta: "Phone number ID" + token da empresa) e gateway HTTP de SMS (da empresa ou
    da plataforma: `SMS_API_URL`/`SMS_API_TOKEN`). As mensagens entram numa fila e são enviadas de 20 em 20 segundos
    (3 tentativas). Uma falha no envio nunca desfaz a fatura ou o pagamento.
- Botões WhatsApp/SMS aparecem (conforme o plano) em Faturas, Pagamentos, Caixa e Devedores (com "Lembrar todos").

## 4. Regras principais

- **Cliente sem duplicados:** na mesma empresa não se aceita o mesmo documento, o mesmo telefone ou o mesmo NUIT —
  o formulário avisa logo enquanto se escreve. Para outra casa do mesmo cliente, adiciona-se uma **nova conta (contrato)**.
- **Cliente com operações nunca é apagado:** se já teve leituras, faturas, pagamentos ou mensagens, "Apagar" desativa-o,
  suspende as contas e bloqueia o acesso ao portal — todo o histórico fica. Só um cliente sem nenhuma operação é apagado.
  (As chaves estrangeiras da base de dados também o impedem.) O mesmo para mediadores com leituras: ficam bloqueados.
- **Leitura com valor a pagar:** ao escrever a leitura atual aparecem a leitura anterior, o consumo, o valor a pagar
  (água, saneamento, taxa) e a dívida total — no escritório e no telemóvel do mediador, mesmo sem internet.
- **Várias contas por cliente:** cada conta tem o seu contador, leituras e faturas. Extrato de todas juntas,
  uma por página, ou só de uma conta.
- **Tarifas de cada provedor** (Tarifas):
  - *Valor mínimo + preço por m³* — ex.: até 5 m³ paga 350; cada m³ acima paga 70 (8 m³ = 350 + 3×70 = 560);
  - *Escalões por categoria* (doméstico, comercial, público, industrial);
  - mais taxa fixa e saneamento (%), com simulador.
- **Pagar aos poucos:** qualquer valor até à dívida. Fatura de 300 → paga 100 (fica 200) → paga 250
  (200 liquidam a fatura e 50 vão para a seguinte). Pode escolher as faturas a pagar.
- **Validar e apagar pagamentos:** pagamentos por M-Pesa/banco podem ficar "por validar"; apagar = anular com motivo
  (o valor volta à dívida e o recibo fica no histórico).
- **Editar leitura:** corrige a leitura e recalcula a fatura (se ainda não tiver pagamentos).
- **Multas e juros** (Empresa e recibo): multa em % ou valor fixo, dias de tolerância, juros por mês; todos os dias às 00:30.
- **Recibo editável:** logótipo, nome, localização, NUIT, cor, título, cabeçalho, **palavras especiais**, rodapé,
  instruções de pagamento, A5/A4/térmico, **horizontal** ou vertical, nº de vias. Mostra leitura anterior e atual,
  quanto foi pago (também **por extenso**), quanto falta e a dívida total. Cada recibo imprime-se sozinho e baixa-se
  em **PDF** (botão "Baixar PDF"); o extrato é um documento à parte.
- **Imprimir e baixar com filtros em todo o sistema:** cada lista tem *Imprimir* e *Excel (CSV)* com os filtros aplicados.
- **Relatórios ≠ extratos:** relatórios resumem a empresa (faturação, recebimentos, quem pagou, devedores, consumo,
  mediadores, caixa); o extrato é a conta corrente de um cliente.

---

## 5. Sem internet

- **Mediador** (`/reader`): descarrega as contas, regista leituras sem rede e envia quando a ligação voltar.
- **Caixa e registo de clientes:** se a internet cair, o pagamento ou o cliente fica guardado no aparelho
  (botão "N por enviar" no topo) e é enviado sozinho quando a ligação volta. Cada operação tem um identificador
  único: enviar duas vezes não duplica. Na caixa, "Guardar para usar sem internet" guarda a lista de devedores.
- Os navegadores só permitem o modo offline em **HTTPS** ou em `localhost`. Em produção use HTTPS e `COOKIE_SECURE=true`.

---

## 6. Base de dados (convenção bip-pme)

Tabela no plural, chave `id_<entidade>`, colunas `<campo>_<entidade>`, chaves estrangeiras `id_<outra>_<entidade>`.

| Tabela | Conteúdo |
|---|---|
| `companies` / `company_settings` | Empresas (com o **plano**) e as suas regras (tarifa, multas, juros, recibo, números de WhatsApp/SMS) |
| `tariff_tiers` | Escalões por categoria |
| `users` / `password_resets` | Utilizadores (email único) e pedidos de recuperação de senha |
| `customers` / `accounts` / `meters` | Clientes, contas (contratos) e contadores |
| `readings` | Leituras (`client_uuid` evita duplicados do modo offline) |
| `invoices` | Faturas de consumo e avulsas |
| `payments` / `payment_allocations` | Pagamentos e a parte aplicada a cada fatura |
| `messages` | Mensagens WhatsApp/SMS (fila, enviadas, por abrir, com falha) |
| `sequences` / `audit_logs` | Numeração e auditoria |

Entidades Java são geradas de uma só especificação: `python3 tools/gen_model.py` (campos marcados `v2` vêm da
migração `V2__plans_messages.sql`, escrita à mão; o `V1__schema.sql` nunca muda depois de aplicado).
A V2 também acrescenta regras (valores nunca negativos), chaves estrangeiras e índices para as listas mais usadas.
As listas e relatórios usam SQL em `src/main/resources/sql/*.sql`, testadas com `python3 tools/test_sql.py`.

---

## 7. Estrutura do código

```
src/main/java/mz/agua
├── config/      SecurityConfig (sessão), AppProperties, PasswordConfig
├── security/    SessionUser, CurrentUser (perfis + isolamento por empresa), filtros
├── domain/      entidades (Lombok, geradas)
├── dto/         pedidos da API com validação (@NotBlank, @Email, @Positive…)
├── repository/  Spring Data JPA
├── service/     regras de negócio (TariffCalculator e LateChargeCalculator com testes)
├── web/         controladores REST (/api/...) e PageController
└── common/      Db/SqlRegistry (consultas nomeadas), Q (filtros), erros, códigos
src/main/resources
├── application.properties · db/migration · sql/
├── pages/       telas (geradas por tools/build_pages.py a partir de tools/pages)
└── static/      css, js/app.js, js/print-docs.js, js/pages/*.js, vendor (Font Awesome, jsPDF), sw.js
```
