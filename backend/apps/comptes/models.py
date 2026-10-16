"""Utilisateur du CIR : client inscrit ou membre de l'équipe, connecté par e-mail."""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from .adresses import adresse_est_complete
from .roles import Role, est_role_equipe


class GestionnaireUtilisateurs(BaseUserManager):
    use_in_migrations = True

    def _creer(self, email, password, **champs):
        if not email:
            raise ValueError("L'adresse e-mail est obligatoire.")
        utilisateur = self.model(email=self.normalize_email(email).lower(), **champs)
        utilisateur.set_password(password)  # haché, jamais stocké en clair (BNF-06)
        utilisateur.save(using=self._db)
        return utilisateur

    def create_user(self, email, password=None, **champs):
        champs.setdefault("role", Role.CLIENT)
        return self._creer(email, password, **champs)

    def create_superuser(self, email, password=None, **champs):
        champs["role"] = Role.SUPER_ADMIN
        return self._creer(email, password, **champs)

    def equipe(self):
        return self.filter(role__in=[Role.MEMBRE, Role.SUPER_ADMIN])

    def clients(self):
        return self.filter(role=Role.CLIENT)


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField("e-mail", unique=True)
    nom_complet = models.CharField("nom complet", max_length=150)
    telephone = models.CharField("téléphone", max_length=30, blank=True)
    role = models.CharField("rôle", max_length=20, choices=Role.choices, default=Role.CLIENT, db_index=True)

    # Adresse (obligatoire pour commander)
    ville = models.CharField(max_length=80, blank=True)
    quartier = models.CharField(max_length=80, blank=True)
    rue_ou_repere = models.CharField("rue ou repère", max_length=200, blank=True)

    is_active = models.BooleanField("actif", default=True)
    # Calculé à partir du rôle (accès à l'administration Django) : ne pas modifier à la main.
    is_staff = models.BooleanField("accès à l'administration", default=False, editable=False)
    date_inscription = models.DateTimeField("inscrit le", default=timezone.now)

    objects = GestionnaireUtilisateurs()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["nom_complet"]

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"
        ordering = ["-date_inscription"]

    def __str__(self):
        return f"{self.nom_complet} <{self.email}>"

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        self.is_staff = est_role_equipe(self.role)
        self.is_superuser = self.role == Role.SUPER_ADMIN
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "role" in update_fields:
            kwargs["update_fields"] = set(update_fields) | {"is_staff", "is_superuser"}
        super().save(*args, **kwargs)

    @property
    def est_equipe(self):
        return est_role_equipe(self.role)

    @property
    def est_super_admin(self):
        return self.role == Role.SUPER_ADMIN

    @property
    def adresse_complete(self):
        """Vrai si ville, quartier et rue ou repère sont renseignés (condition pour commander)."""
        return adresse_est_complete(self.ville, self.quartier, self.rue_ou_repere)

    @property
    def adresse_formatee(self):
        return ", ".join(p for p in (self.rue_ou_repere, self.quartier, self.ville) if p.strip())
