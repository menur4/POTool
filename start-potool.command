#!/bin/bash
# POTool — Démarrage des serveurs (backend + frontend)
# Double-cliquez sur ce fichier pour lancer l'application.

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Démarrage de POTool..."
echo "   Dossier: $PROJECT_DIR"
echo ""

# Lancer le backend (Express) en arrière-plan
echo "▶ Backend (Express sur port 5001)..."
cd "$PROJECT_DIR"
npm start &
BACKEND_PID=$!

# Lancer le frontend (React sur port 3001)
echo "▶ Frontend (React sur port 3001)..."
cd "$PROJECT_DIR/client"
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Serveurs lancés !"
echo "   Backend  PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "   Frontend: http://localhost:3001"
echo "   Backend:  http://localhost:5001"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter les deux serveurs."

# Intercepter Ctrl+C pour arrêter proprement les deux processus
trap "echo ''; echo '⏹ Arrêt des serveurs...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

# Attendre que les deux processus tournent
wait
