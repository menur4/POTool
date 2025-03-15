#!/bin/bash

# Script pour envoyer le code sur GitHub
# Utilisation: ./scripts/push-to-github.sh "Message de commit"

# Vérifier si un message de commit a été fourni
if [ -z "$1" ]; then
  echo "Erreur: Veuillez fournir un message de commit"
  echo "Utilisation: ./scripts/push-to-github.sh \"Message de commit\""
  exit 1
fi

# Vérifier si le dépôt distant est configuré
REMOTE_EXISTS=$(git remote -v | grep origin)
if [ -z "$REMOTE_EXISTS" ]; then
  echo "Aucun dépôt distant 'origin' n'est configuré."
  echo "Veuillez configurer un dépôt distant avec:"
  echo "git remote add origin https://github.com/votre-nom/potool.git"
  exit 1
fi

# Ajouter tous les fichiers modifiés
echo "Ajout des fichiers modifiés..."
git add .

# Créer un commit avec le message fourni
echo "Création du commit avec le message: $1"
git commit -m "$1"

# Pousser les changements sur la branche principale
echo "Envoi des changements sur GitHub..."
git push origin main || git push origin master

# Vérifier si la commande push a réussi
if [ $? -eq 0 ]; then
  echo "✅ Code envoyé avec succès sur GitHub!"
  echo "Commit: $1"
  echo "Date: $(date)"
else
  echo "❌ Erreur lors de l'envoi du code sur GitHub."
  echo "Veuillez vérifier vos identifiants et la configuration du dépôt distant."
fi
