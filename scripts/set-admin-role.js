/**
 * Script pour définir le rôle "admin" pour un utilisateur spécifique
 * Usage: node scripts/set-admin-role.js <email_utilisateur>
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Modèle User
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  role: String,
  language: String,
  google: {
    id: String,
    email: String,
    name: String
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: Date
});

const User = mongoose.model('User', userSchema);

// Fonction principale
async function setAdminRole() {
  try {
    // Vérifier si l'email a été fourni
    const userEmail = process.argv[2];
    if (!userEmail) {
      console.error('Veuillez fournir l\'email de l\'utilisateur à promouvoir en admin');
      console.error('Usage: node scripts/set-admin-role.js <email_utilisateur>');
      process.exit(1);
    }

    // Connexion à MongoDB
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error('Erreur: MONGODB_URI non défini dans le fichier .env');
      process.exit(1);
    }

    await mongoose.connect(mongoURI);
    console.log('Connecté à MongoDB');

    // Rechercher l'utilisateur par email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.error(`Aucun utilisateur trouvé avec l'email: ${userEmail}`);
      process.exit(1);
    }

    // Mettre à jour le rôle de l'utilisateur
    user.role = 'admin';
    await user.save();

    console.log(`✅ L'utilisateur ${user.firstName} ${user.lastName} (${user.email}) a été promu au rôle d'administrateur`);
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    // Fermer la connexion à MongoDB
    await mongoose.disconnect();
    console.log('Déconnecté de MongoDB');
  }
}

// Exécuter la fonction principale
setAdminRole();
