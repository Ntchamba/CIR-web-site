from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class TypeBatiment(models.TextChoices):
    MAISON = "maison", "Maison"
    INDUSTRIE = "industrie", "Industrie"
    ENTREPRISE = "entreprise", "Entreprise"


class GestionnaireUtilisateurs(BaseUserManager):
    use_in_migrations = True

    def _creer(self, email, password, **champs):
        if not email:
            raise ValueError("L'adresse e-mail est obligatoire.")
        utilisateur = self.model(email=self.normalize_email(email).lower(), **champs)
        utilisateur.set_password(password)  # mot de passe haché, jamais stocké en clair (BNF-06)
        utilisateur.save(using=self._db)
        return utilisateur

    def create_user(self, email, password=None, **champs):
        champs.setdefault("is_staff", False)
        champs.setdefault("is_superuser", False)
        return self._creer(email, password, **champs)

    def create_superuser(self, email, password=None, **champs):
        champs.update(is_staff=True, is_superuser=True)
        return self._creer(email, password, **champs)


class User(AbstractBaseUser, PermissionsMixin):
    """Visiteur inscrit (client) ou membre de l'équipe (is_staff). Connexion par e-mail."""

    email = models.EmailField("e-mail", unique=True)
    nom_complet = models.CharField("nom complet", max_length=150)
    telephone = models.CharField("téléphone", max_length=30, blank=True)
    type_client = models.CharField(
        "type de client", max_length=20, choices=TypeBatiment.choices, default=TypeBatiment.MAISON
    )
    is_active = models.BooleanField("actif", default=True)
    is_staff = models.BooleanField("membre de l'équipe", default=False)
    date_joined = models.DateTimeField("inscrit le", default=timezone.now)

    objects = GestionnaireUtilisateurs()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nom_complet"]

    class Meta:
        verbose_name = "utilisateur"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.nom_complet} <{self.email}>"

    @property
    def a_une_adresse(self):
        """Règle de gestion : une commande exige une adresse complète."""
        adresse = getattr(self, "adresse", None)
        return bool(adresse and adresse.est_complete)

    @property
    def initiales(self):
        mots = [m for m in self.nom_complet.split() if m]
        return "".join(m[0] for m in mots[:2]).upper() or self.email[:2].upper()


class Adresse(models.Model):
    """Adresse du client, obligatoire pour commander (BF-08, BNF-01)."""

    utilisateur = models.OneToOneField(User, on_delete=models.CASCADE, related_name="adresse")
    pays = models.CharField(max_length=60, default="Cameroun")
    ville = models.CharField(max_length=80)
    quartier = models.CharField(max_length=80)
    rue_repere = models.CharField("rue ou repère", max_length=200)
    complement = models.CharField("complément", max_length=200, blank=True)

    class Meta:
        verbose_name = "adresse"

    def __str__(self):
        return f"{self.rue_repere}, {self.quartier}, {self.ville}"

    @property
    def est_complete(self):
        return all([self.ville.strip(), self.quartier.strip(), self.rue_repere.strip()])
