package space.manus.akeer14.mobile.agent.t20260824151421

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Properties
import javax.mail.Authenticator
import javax.mail.Message
import javax.mail.PasswordAuthentication
import javax.mail.Session
import javax.mail.Transport
import javax.mail.internet.InternetAddress
import javax.mail.internet.MimeBodyPart
import javax.mail.internet.MimeMessage
import javax.mail.internet.MimeMultipart

data class GmailResult(val ok: Boolean, val description: String)

class GmailEvidenceSender {
  suspend fun test(config: AgentConfig): GmailResult = withContext(Dispatchers.IO) {
    runCatching {
      require(config.gmailReady) { "إعدادات Gmail غير مكتملة أو النسخ الاحتياطي غير مفعّل." }
      val transport = session(config).getTransport("smtp")
      try {
        transport.connect(config.gmailHost, config.gmailPort, config.gmailUsername, config.gmailAppPassword)
      } finally {
        runCatching { transport.close() }
      }
      GmailResult(true, "نجح اتصال SMTP مع ${config.gmailHost}:${config.gmailPort}.")
    }.getOrElse { GmailResult(false, it.message ?: "تعذر اختبار اتصال Gmail.") }
  }

  suspend fun sendEvidence(config: AgentConfig, file: File, title: String): GmailResult = withContext(Dispatchers.IO) {
    runCatching {
      require(config.gmailReady) { "إعدادات Gmail غير مكتملة أو النسخ الاحتياطي غير مفعّل." }
      require(file.exists() && file.length() > 1024L) { "ملف الدليل غير موجود أو غير مكتمل." }
      val message = MimeMessage(session(config)).apply {
        setFrom(InternetAddress(config.gmailUsername))
        setRecipients(Message.RecipientType.TO, InternetAddress.parse(config.gmailRecipient, false))
        subject = "Akeer14 evidence — $title"
        val body = MimeBodyPart().apply { setText("تم إنشاء الدليل من الهاتف العامل. العنوان: $title", "UTF-8") }
        val attachment = MimeBodyPart().apply { attachFile(file) }
        setContent(MimeMultipart().apply { addBodyPart(body); addBodyPart(attachment) })
      }
      Transport.send(message)
      GmailResult(true, "أُرسلت نسخة Gmail إلى ${config.gmailRecipient}.")
    }.getOrElse { GmailResult(false, it.message ?: "تعذر إرسال النسخة الاحتياطية إلى Gmail.") }
  }

  private fun session(config: AgentConfig): Session {
    val properties = Properties().apply {
      put("mail.smtp.auth", "true")
      put("mail.smtp.starttls.enable", (config.gmailPort == 587).toString())
      put("mail.smtp.ssl.enable", (config.gmailPort == 465).toString())
      put("mail.smtp.host", config.gmailHost)
      put("mail.smtp.port", config.gmailPort.toString())
      put("mail.smtp.connectiontimeout", "20000")
      put("mail.smtp.timeout", "30000")
      put("mail.smtp.writetimeout", "30000")
    }
    return Session.getInstance(properties, object : Authenticator() {
      override fun getPasswordAuthentication() = PasswordAuthentication(config.gmailUsername, config.gmailAppPassword)
    })
  }
}
