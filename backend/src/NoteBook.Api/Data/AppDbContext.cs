using Microsoft.EntityFrameworkCore;
using NoteBook.Api.Models;

namespace NoteBook.Api.Data;

public class AppDbContext : DbContext {
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Block> Blocks => Set<Block>();
    public DbSet<NoteLink> NoteLinks => Set<NoteLink>();
    public DbSet<Space> Spaces => Set<Space>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Space>(entity => {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Name).HasMaxLength(100).IsRequired();
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => s.ParentSpaceId);
            entity.HasIndex(s => s.Position);

            entity.HasOne(s => s.User)
                  .WithMany()
                  .HasForeignKey(s => s.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.ParentSpace)
                  .WithMany(s => s.SubSpaces)
                  .HasForeignKey(s => s.ParentSpaceId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<User>(entity => {
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.Username).IsUnique();
            entity.Property(u => u.Username).HasMaxLength(100).IsRequired();
            entity.Property(u => u.Email).HasMaxLength(200);
            entity.Property(u => u.ResetCode).HasMaxLength(50);
            entity.Property(u => u.PasswordHash).IsRequired();
        });

        modelBuilder.Entity<Note>(entity => {
            entity.HasKey(n => n.Id);
            entity.Property(n => n.Title).HasMaxLength(200);
            entity.Property(n => n.Color).HasMaxLength(20).HasDefaultValue("#ffffff");
            entity.HasIndex(n => n.Position);
            entity.HasIndex(n => n.Title);
            entity.HasIndex(n => n.UserId);
            entity.HasIndex(n => n.SpaceId);
            entity.HasOne(n => n.User)
                  .WithMany()
                  .HasForeignKey(n => n.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(n => n.Space)
                  .WithMany(s => s.Notes)
                  .HasForeignKey(n => n.SpaceId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasMany(n => n.Blocks)
                  .WithOne(b => b.Note)
                  .HasForeignKey(b => b.NoteId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Block>(entity => {
            entity.HasKey(b => b.Id);
            entity.Property(b => b.Type).HasMaxLength(50).IsRequired();
            entity.HasIndex(b => new { b.NoteId, b.Position });

            if (Database.IsNpgsql()) {
                entity.Property(b => b.ContentJson).HasColumnType("jsonb");
            }
        });

        modelBuilder.Entity<NoteLink>(entity => {
            entity.HasKey(nl => nl.Id);
            entity.Property(nl => nl.LinkTitle).HasMaxLength(200).IsRequired();
            entity.HasIndex(nl => nl.SourceNoteId);
            entity.HasIndex(nl => nl.TargetNoteId);
            entity.HasIndex(nl => nl.LinkTitle);

            entity.HasOne(nl => nl.SourceNote)
                  .WithMany()
                  .HasForeignKey(nl => nl.SourceNoteId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(nl => nl.TargetNote)
                  .WithMany()
                  .HasForeignKey(nl => nl.TargetNoteId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
