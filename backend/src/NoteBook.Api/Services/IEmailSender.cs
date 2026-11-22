namespace NoteBook.Api.Services;

public interface IEmailSender {
    Task<bool> SendPasswordResetEmailAsync(string toEmail, string resetCode, string username);
}
