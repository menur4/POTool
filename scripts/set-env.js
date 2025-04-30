/**
 * Script pour changer d'environnement (development, preprod, production)
 * Usage: node scripts/set-env.js [development|preprod|production]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Créer une interface readline pour l'interaction utilisateur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Environnements disponibles
const ENVIRONMENTS = ['development', 'preprod', 'production'];

// Chemin vers le fichier .env
const ENV_FILE_PATH = path.join(__dirname, '..', '.env');

// Fonction pour mettre à jour le fichier .env
const updateEnvFile = (env) => {
  try {
    // Vérifier si le fichier .env existe
    if (!fs.existsSync(ENV_FILE_PATH)) {
      console.error('Fichier .env introuvable. Veuillez créer un fichier .env à la racine du projet.');
      process.exit(1);
    }

    // Lire le contenu du fichier .env
    let envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
    
    // Mettre à jour la variable NODE_ENV
    if (envContent.includes('NODE_ENV=')) {
      envContent = envContent.replace(/NODE_ENV=.*/, `NODE_ENV=${env}`);
    } else {
      envContent = `NODE_ENV=${env}\n${envContent}`;
    }
    
    // Écrire les modifications dans le fichier .env
    fs.writeFileSync(ENV_FILE_PATH, envContent);
    
    console.log(`✅ Environnement changé avec succès pour: ${env}`);
    
    // Afficher un message spécifique à l'environnement
    switch (env) {
      case 'development':
        console.log('🛠️  Mode développement activé - Utilisez cette configuration pour le développement local');
        break;
      case 'preprod':
        console.log('🔍 Mode préproduction activé - Utilisez cette configuration pour les tests avant production');
        break;
      case 'production':
        console.log('🚀 Mode production activé - Attention: ce mode est destiné à l\'environnement de production');
        break;
    }
    
    console.log('\nPour appliquer les changements, redémarrez le serveur:');
    console.log('npm run dev');
    
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du fichier .env: ${error.message}`);
    process.exit(1);
  }
};

// Fonction principale
const main = () => {
  // Récupérer l'environnement spécifié en argument
  const specifiedEnv = process.argv[2];
  
  // Si un environnement est spécifié et qu'il est valide
  if (specifiedEnv && ENVIRONMENTS.includes(specifiedEnv)) {
    updateEnvFile(specifiedEnv);
    rl.close();
  } 
  // Si aucun environnement n'est spécifié ou s'il est invalide
  else {
    console.log('Veuillez choisir un environnement:');
    ENVIRONMENTS.forEach((env, index) => {
      console.log(`${index + 1}. ${env}`);
    });
    
    rl.question('Votre choix (numéro): ', (answer) => {
      const choice = parseInt(answer);
      
      if (choice >= 1 && choice <= ENVIRONMENTS.length) {
        updateEnvFile(ENVIRONMENTS[choice - 1]);
      } else {
        console.error('Choix invalide. Veuillez spécifier un numéro valide.');
      }
      
      rl.close();
    });
  }
};

// Exécuter la fonction principale
main();
