#!/bin/bash
echo ""
echo "======================================"
echo "  UCAC-ICAM Multi-Agents IA"
echo "======================================"
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "ERREUR : Node.js n'est pas installé."
    echo "Téléchargez-le sur https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERREUR : Node.js version $NODE_VERSION détectée. Version 18+ requise."
    exit 1
fi

echo "Node.js $(node -v) détecté ✓"
echo ""

# Vérifier .env
if [ ! -f "backend/.env" ]; then
    echo "Configuration requise :"
    cp backend/.env.example backend/.env
    echo "  → Fichier backend/.env créé"
    echo "  → Ouvrez backend/.env et ajoutez votre clé ANTHROPIC_API_KEY"
    echo ""
    echo "Puis relancez ce script."
    exit 1
fi

# Installer dépendances si nécessaire
if [ ! -d "backend/node_modules" ]; then
    echo "Installation des dépendances backend..."
    cd backend && npm install && cd ..
    echo "Dépendances backend installées ✓"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installation des dépendances frontend..."
    cd frontend && npm install && cd ..
    echo "Dépendances frontend installées ✓"
fi

echo ""
echo "Démarrage du backend sur http://localhost:3001 ..."
cd backend && node server.js &
BACKEND_PID=$!
sleep 2

echo "Démarrage du frontend sur http://localhost:5173 ..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "  App disponible sur :"
echo "  http://localhost:5173"
echo "======================================"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter."

# Attendre et nettoyer
wait
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
