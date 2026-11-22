using System.Net;
using System.Net.Mail;
using System.Text;

namespace NoteBook.Api.Services;

public class SmtpEmailSender : IEmailSender {
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger) {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> SendPasswordResetEmailAsync(string toEmail, string resetCode, string username) {
        var resendKey = _configuration["Resend:ApiKey"] ?? Environment.GetEnvironmentVariable("RESEND_API_KEY");
        if (!string.IsNullOrWhiteSpace(resendKey)) {
            try {
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", resendKey.Trim());
                var resendFrom = _configuration["Resend:FromEmail"] ?? "NoteBook Security <onboarding@resend.dev>";
                var htmlBody = GenerateHtmlBody(resetCode, username);
                var plainTextBody = GeneratePlainTextBody(resetCode, username);
                var payload = new {
                    from = resendFrom,
                    to = new[] { toEmail },
                    subject = "Your NoteBook Password Reset Code",
                    html = htmlBody,
                    text = plainTextBody
                };
                var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync("https://api.resend.com/emails", content);
                if (response.IsSuccessStatusCode) {
                    _logger.LogInformation("Password reset email sent to {ToEmail} via Resend API", toEmail);
                    return true;
                }
                var err = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Resend API returned status {Status}: {Body}", response.StatusCode, err);
            } catch (Exception ex) {
                _logger.LogWarning(ex, "Failed to send email via Resend API to {ToEmail}", toEmail);
            }
        }

        var host = _configuration["Smtp:Host"] ?? Environment.GetEnvironmentVariable("SMTP_HOST");
        var portStr = _configuration["Smtp:Port"] ?? Environment.GetEnvironmentVariable("SMTP_PORT") ?? "587";
        var port = int.TryParse(portStr, out var p) ? p : 587;
        var smtpUser = _configuration["Smtp:Username"] ?? Environment.GetEnvironmentVariable("SMTP_USER");
        var smtpPass = _configuration["Smtp:Password"] ?? Environment.GetEnvironmentVariable("SMTP_PASS");
        var fromEmail = _configuration["Smtp:FromEmail"] ?? Environment.GetEnvironmentVariable("SMTP_FROM") ?? "noreply@mynotebook.runasp.net";
        var fromName = _configuration["Smtp:FromName"] ?? "NoteBook";
        var sslStr = _configuration["Smtp:EnableSsl"] ?? "true";
        var enableSsl = !bool.TryParse(sslStr, out var s) || s;

        if (string.IsNullOrWhiteSpace(host)) {
            _logger.LogInformation("SMTP not configured; simulated email to {ToEmail} with code {ResetCode}", toEmail, resetCode);
            return true;
        }

        try {
            var htmlBody = GenerateHtmlBody(resetCode, username);
            var plainTextBody = GeneratePlainTextBody(resetCode, username);

            using var message = new MailMessage();
            message.From = new MailAddress(fromEmail, fromName);
            message.To.Add(toEmail);
            message.Subject = "Your NoteBook Password Reset Code";
            message.Body = plainTextBody;

            var plainTextView = AlternateView.CreateAlternateViewFromString(plainTextBody, Encoding.UTF8, "text/plain");
            var htmlView = AlternateView.CreateAlternateViewFromString(htmlBody, Encoding.UTF8, "text/html");
            message.AlternateViews.Add(plainTextView);
            message.AlternateViews.Add(htmlView);

            using var client = new SmtpClient(host, port) {
                EnableSsl = enableSsl,
                Timeout = 10000
            };

            if (!string.IsNullOrWhiteSpace(smtpUser)) {
                client.Credentials = new NetworkCredential(smtpUser, smtpPass ?? string.Empty);
            }

            await client.SendMailAsync(message);
            _logger.LogInformation("Password reset email sent to {ToEmail}", toEmail);
            return true;
        } catch (Exception ex) {
            _logger.LogWarning(ex, "Failed to send password reset email via SMTP to {ToEmail}", toEmail);
            return false;
        }
    }

    public string GenerateHtmlBody(string resetCode, string username) {
        var safeUsername = WebUtility.HtmlEncode(username);
        var safeCode = WebUtility.HtmlEncode(resetCode);

        return $@"<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>Password Reset Code</title>
</head>
<body style=""margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1b1f;"">
  <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""background-color: #f8f9fa; padding: 32px 16px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e0e2ec; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;"">
          <!-- Header -->
          <tr>
            <td style=""background-color: #6750a4; padding: 28px 32px; text-align: center;"">
              <h1 style=""margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;"">NoteBook</h1>
              <p style=""margin: 4px 0 0; font-size: 13px; color: #e8def8;"">Personal Knowledge Base</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style=""padding: 32px;"">
              <h2 style=""margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1d1b20;"">Password Reset Request</h2>
              <p style=""margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #49454f;"">
                Hello <strong>{safeUsername}</strong>,
              </p>
              <p style=""margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #49454f;"">
                We received a request to reset your password. Use the verification code below to complete your reset request:
              </p>
              <!-- Monospace Code Pill -->
              <div style=""text-align: center; margin: 28px 0;"">
                <div style=""display: inline-block; background-color: #f3edf7; border: 1px solid #e8def8; border-radius: 12px; padding: 16px 28px; font-family: 'Roboto Mono', Menlo, Consolas, Monaco, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #21005d;"">
                  {safeCode}
                </div>
              </div>
              <!-- Expiration Notice -->
              <p style=""margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #79747e; text-align: center;"">
                ⏱️ This code is valid for <strong>15 minutes</strong>.
              </p>
              <hr style=""border: 0; border-top: 1px solid #e0e2ec; margin: 24px 0;"" />
              <!-- Security Advisory -->
              <p style=""margin: 0; font-size: 13px; line-height: 1.5; color: #79747e;"">
                <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email or contact support. Your password will remain unchanged and your account is secure.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style=""background-color: #f4f3f7; padding: 16px 32px; text-align: center; font-size: 12px; color: #79747e; border-top: 1px solid #e0e2ec;"">
              © {DateTime.UtcNow.Year} NoteBook Security. Automated message, do not reply.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
    }

    public string GeneratePlainTextBody(string resetCode, string username) {
        return $@"Hello {username},

We received a request to reset your NoteBook account password.

Your 6-digit verification code is:
{resetCode}

This code is valid for 15 minutes.

If you did not request this password reset, please ignore this email. Your password will remain unchanged.

Best regards,
NoteBook Security Team";
    }
}
