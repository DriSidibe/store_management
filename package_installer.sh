#!/bin/bash

# Activer l'environnement virtuel si nécessaire
# source .env/bin/activate

# Lire requirements.txt
while IFS= read -r package
do
    # Nettoyer la ligne (enlever les commentaires et espaces)
    package_clean=$(echo "$package" | sed 's/[[:space:]]//g' | cut -d'#' -f1)

    if [ -z "$package_clean" ]; then
        continue
    fi

    echo "🔵 Installation de $package_clean ..."

    # Essayer avec pip
    if pip install "$package_clean"; then
        echo "✅ $package_clean installé avec pip."
    else
        echo "⚠️  Échec pip pour $package_clean."

        # Extraire juste le nom sans version
        package_name=$(echo "$package_clean" | cut -d'=' -f1 | cut -d'>' -f1 | cut -d'<' -f1)

        echo "➡️ Tentative d'installation via apt : python3-$package_name"

        # Essayer avec apt
        if sudo apt update && sudo apt install -y "python3-$package_name"; then
            echo "✅ $package_name installé via apt."
        else
            echo "❌ Échec aussi via apt pour $package_name. Installation manuelle nécessaire."
        fi
    fi

    echo ""
done < "requirements.txt"

echo "🎉 Script terminé."

