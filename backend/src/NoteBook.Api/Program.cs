using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using NoteBook.Api.Data;
using NoteBook.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Database=notebookdb;Username=postgres;Password=postgres";

builder.Services.AddDbContext<AppDbContext>(options => {
    options.UseNpgsql(connectionString);
});

var jwtKey = builder.Configuration["Jwt:Key"] ?? "NoteBookSuperSecretKeyForDevelopment2026Secure123!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "NoteBookApi";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "NoteBookClient";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IFileStorageService, LocalFileStorageService>();
builder.Services.AddScoped<ILinkParserService, LinkParserService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

using (var scope = app.Services.CreateScope()) {
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try {
        db.Database.EnsureCreated();
        if (db.Database.IsRelational()) {
            db.Database.ExecuteSqlRaw(@"
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""Email"" character varying(200) NULL;
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""AvatarUrl"" character varying(500) NULL;
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""ResetCode"" character varying(50) NULL;
                ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""ResetCodeExpiresAt"" timestamp with time zone NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Users_Email"" ON ""Users"" (""Email"") WHERE ""Email"" IS NOT NULL;

                ALTER TABLE ""Notes"" ADD COLUMN IF NOT EXISTS ""UserId"" uuid NULL;
                UPDATE ""Notes"" SET ""UserId"" = (SELECT ""Id"" FROM ""Users"" ORDER BY ""CreatedAt"" ASC LIMIT 1) WHERE ""UserId"" IS NULL;
                CREATE INDEX IF NOT EXISTS ""IX_Notes_UserId"" ON ""Notes"" (""UserId"");

                CREATE TABLE IF NOT EXISTS ""Spaces"" (
                    ""Id"" uuid NOT NULL,
                    ""Name"" character varying(100) NOT NULL,
                    ""ParentSpaceId"" uuid NULL,
                    ""UserId"" uuid NOT NULL,
                    ""Position"" integer NOT NULL DEFAULT 0,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_Spaces"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_Spaces_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_Spaces_Spaces_ParentSpaceId"" FOREIGN KEY (""ParentSpaceId"") REFERENCES ""Spaces"" (""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_Spaces_UserId"" ON ""Spaces"" (""UserId"");
                CREATE INDEX IF NOT EXISTS ""IX_Spaces_ParentSpaceId"" ON ""Spaces"" (""ParentSpaceId"");
                CREATE INDEX IF NOT EXISTS ""IX_Spaces_Position"" ON ""Spaces"" (""Position"");

                ALTER TABLE ""Notes"" ADD COLUMN IF NOT EXISTS ""SpaceId"" uuid NULL;
                CREATE INDEX IF NOT EXISTS ""IX_Notes_SpaceId"" ON ""Notes"" (""SpaceId"");

                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Notes_Spaces_SpaceId') THEN
                        ALTER TABLE ""Notes"" ADD CONSTRAINT ""FK_Notes_Spaces_SpaceId"" FOREIGN KEY (""SpaceId"") REFERENCES ""Spaces"" (""Id"") ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Notes_Users_UserId') THEN
                        ALTER TABLE ""Notes"" ADD CONSTRAINT ""FK_Notes_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE;
                    END IF;
                END $$;

                CREATE TABLE IF NOT EXISTS ""NoteLinks"" (
                    ""Id"" uuid NOT NULL,
                    ""SourceNoteId"" uuid NOT NULL,
                    ""TargetNoteId"" uuid NULL,
                    ""LinkTitle"" character varying(200) NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_NoteLinks"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_NoteLinks_Notes_SourceNoteId"" FOREIGN KEY (""SourceNoteId"") REFERENCES ""Notes"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_NoteLinks_Notes_TargetNoteId"" FOREIGN KEY (""TargetNoteId"") REFERENCES ""Notes"" (""Id"") ON DELETE SET NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_NoteLinks_LinkTitle"" ON ""NoteLinks"" (""LinkTitle"");
                CREATE INDEX IF NOT EXISTS ""IX_NoteLinks_SourceNoteId"" ON ""NoteLinks"" (""SourceNoteId"");
                CREATE INDEX IF NOT EXISTS ""IX_NoteLinks_TargetNoteId"" ON ""NoteLinks"" (""TargetNoteId"");

                -- Seed default ""General"" space for users with unassigned notes or without spaces
                INSERT INTO ""Spaces"" (""Id"", ""Name"", ""ParentSpaceId"", ""UserId"", ""Position"", ""CreatedAt"")
                SELECT gen_random_uuid(), 'General', NULL, u.""Id"", 0, NOW()
                FROM ""Users"" u
                WHERE NOT EXISTS (
                    SELECT 1 FROM ""Spaces"" s WHERE s.""UserId"" = u.""Id""
                );

                UPDATE ""Notes"" n
                SET ""SpaceId"" = s.""Id""
                FROM ""Spaces"" s
                WHERE n.""UserId"" = s.""UserId"" 
                  AND s.""Name"" = 'General' 
                  AND n.""SpaceId"" IS NULL;
            ");
        }

        // Seed default ""General"" space for users with unassigned notes or without spaces (relational + test/in-memory)
        var usersWithUnassignedNotes = db.Notes
            .Where(n => n.SpaceId == null)
            .Select(n => n.UserId)
            .Distinct()
            .ToList();

        var usersWithoutSpaces = db.Users
            .Where(u => !db.Spaces.Any(s => s.UserId == u.Id))
            .Select(u => u.Id)
            .ToList();

        var targetUserIds = usersWithUnassignedNotes.Union(usersWithoutSpaces).Distinct().ToList();

        foreach (var userId in targetUserIds) {
            var generalSpace = db.Spaces.FirstOrDefault(s => s.UserId == userId && s.Name == "General");
            if (generalSpace == null) {
                generalSpace = new NoteBook.Api.Models.Space {
                    Id = Guid.NewGuid(),
                    Name = "General",
                    UserId = userId,
                    Position = 0,
                    CreatedAt = DateTime.UtcNow
                };
                db.Spaces.Add(generalSpace);
                db.SaveChanges();
            }

            var unassignedNotes = db.Notes.Where(n => n.UserId == userId && n.SpaceId == null).ToList();
            foreach (var note in unassignedNotes) {
                note.SpaceId = generalSpace.Id;
            }
            if (unassignedNotes.Any()) {
                db.SaveChanges();
            }
        }
    } catch (Exception ex) {
        app.Logger.LogWarning(ex, "Database EnsureCreated/table initialization failed on startup (normal in test environments)");
    }
}

app.UseDefaultFiles();
app.UseStaticFiles();

var uploadsDir = app.Configuration["Storage:UploadsPath"]
    ?? Path.Combine(app.Environment.ContentRootPath, "App_Data", "uploads");

if (!Directory.Exists(uploadsDir)) {
    Directory.CreateDirectory(uploadsDir);
}

app.UseStaticFiles(new StaticFileOptions {
    FileProvider = new PhysicalFileProvider(uploadsDir),
    RequestPath = "/uploads"
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
