# Coaching personnalisé — 4 novembre 2026

## Priorité et conservation des objectifs

1. Une cible modifiée dans la séance est toujours celle utilisée par son moteur.
2. Un réglage personnel enregistré sur la fiche exercice prime lors de la création d’une séance, y compris issue d’un programme ou d’un modèle.
3. Vient ensuite la cible du programme ou du modèle.
4. Sans cible, le dernier objectif connu est repris.
5. Sans objectif connu, un repère initial adapté au mouvement et à l’objectif du profil est prérempli, identifié comme modifiable. Il ne remplace jamais une cible existante.

Les anciennes cibles 8–12 restent conservées : on ne peut pas déduire si elles étaient intentionnelles. Changer le profil ne réécrit ni séances, ni programmes. Les modèles récents conservent désormais la **cible** de répétitions, tout en vidant les performances réelles, charges et répétitions. Les anciens modèles restent compatibles.

## Nombre fixe et plage

- Fixe : `reps_min === reps_max`. À 3 × 10 et 70 kg, 10/9/8 ou 10/10/9 → maintien de 70 kg avec cible 10/10/10. Une hausse conserve également 10 ; aucune réduction implicite vers 8.
- Plage : double progression, un ajout de répétition au total jusqu’au haut de la plage. Le prochain palier repart de **la borne basse choisie**, jamais d’un 8 universel.
- Hausse conditionnelle après deux occurrences comparables confirmées, ou trois si niveau avancé déclaré. Régler l’historique à au moins trois pour ce dernier mode. Technique validée ; échecs, effort trop difficile, récupération insuffisante, anciennes mesures d’effort hors seuil et signaux de baisse restent prioritaires.
- En mode fixe, la dernière occurrence doit aussi déclarer une récupération bonne et un effort facile/maîtrisé ou un RIR suffisant. Une donnée absente n’est pas remplacée par une marge inventée.
- Objectif d’entretien : maintenir une cible confirmée est une issue valide.
- Les comparaisons de séries, repos, supersets, tendances et le repère limité à la première série du 2 novembre restent décrits dans [PROGRESSION.md](PROGRESSION.md). Une pause de plus de 28 jours suspend le plan numérique et invite à réévaluer la reprise, sans appliquer de pourcentage arbitraire de perte de force.

## Matériel et type de mouvement

Une liste de charges disponibles peut être enregistrée par exercice. Le moteur prend le prochain palier réel dans le bon sens, ou le précédent sur machine assistée. Une liste vide signifie matériel inconnu : seul l’incrément configuré sert de repère conditionnel. La convention de saisie reste celle de l’exercice (par haltère si les performances sont saisies ainsi). Aucune conversion entre machines ou charge corporelle n’est inventée.

Limite de variation proposée : 5 % pour une isolation identifiée, 10 % pour les autres mouvements, y compris l’assistance. Un palier disproportionné ou absent conduit au maintien, sans arrondi vers un poids inexistant. Ces plafonds sont des choix de produit conservateurs, **pas des seuils physiologiques validés**. Les petits incréments restent configurables.

La base extensible `training-knowledge.ts` distingue les mouvements identifiés par famille et leur propose des repères techniques. Les dix plages d’hypertrophie données dans le cahier des charges sont des points de départ facultatifs. Force, endurance et entretien ont d’autres repères. Les variantes non identifiées utilisent un repère générique explicitement modifiable ; leur biomécanique n’est pas déduite de la seule appartenance à un muscle. Les fiches du catalogue restent la source de consignes détaillées et de muscles secondaires. Une erreur de classement peut être corrigée en réglant la cible et l’incrément.

## Ressenti, profil et accueil

Le panneau replié de séance enregistre effort (facile/maîtrisé/difficile), récupération, inconfort et difficulté technique ; RIR/RPE restent **facultatifs et repliés**, hors de la saisie rapide des séries. Inconfort/perte de contrôle actuel ou à la dernière occurrence → aucun plan numérique. Une exécution confortable doit être vérifiée ; aucune blessure n’est diagnostiquée. Copies et modèles ne transportent pas les ressentis de l’ancienne séance.

Le profil permet objectif, niveau, fréquence souhaitée, durée habituelle, préférence de volume et notes de contraintes/matériel/récupération. Objectif/niveau influencent les règles ; fréquence et préférence de volume contextualisent certains conseils. Durée et notes libres restent des informations de contexte consultables, **pas une mesure calculée de mobilité, de fatigue ou de disponibilité matérielle**. Pour agir sur le moteur, déclarer le signal sur l’exercice et les charges disponibles sur sa fiche.

L’accueil analyse six semaines, chaque mouvement face à lui-même : répétitions gagnées à mêmes charges, cible confirmée, stagnation, baisse répétée et retours explicites. Les signaux de prudence précèdent la motivation. Au plus trois conseils, faits séparés des propositions, lien vers les données, masquage pour la visite. Les nouvelles séances renouvellent les faits. Volume direct des sept derniers jours comparé aux sept précédents : au moins 6 séries auparavant, au moins 10 maintenant et hausse >50 % → invitation à vérifier récupération/performances, sans conclure au surentraînement. Ni absence de données ni muscle sans travail direct ne prouvent un sous-entraînement.

## Architecture et niveau de confiance

- Calcul : observations comparables et tendances dans `progression.ts`.
- Décision : règles déterministes, testables, données d’effort manquantes explicites.
- Pédagogie : `coach.ts`, explications du plan, connaissances par famille et actions facultatives. Aucun modèle de langage ne calcule les poids ; aucune clé/API IA supplémentaire.

Les principes généraux (spécificité de la force, variété de charges compatible avec l’hypertrophie, individualisation, intérêt de la progression et du volume) sont étayés par la synthèse [ACSM 2026, Currier et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/), et la [méta-analyse en réseau de Currier et al., 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/). La [méta-régression de Robinson et al., 2024](https://pubmed.ncbi.nlm.nih.gov/38970765/) souligne que les associations à la proximité de l’échec doivent être interprétées avec prudence.

**Confiance distincte :** ces synthèses soutiennent les principes, pas les dix plages spécifiques, les plafonds de 5/10 %, deux/trois confirmations, 28 jours ou le seuil de volume. Ces derniers sont des heuristiques de produit révisables. Aucun résultat ni prévention des blessures n’est garanti. Les données disponibles ne permettent pas de construire automatiquement une périodisation individualisée, d’évaluer une morphologie ou d’identifier une fatigue nerveuse.

## Sauvegarde et sécurité

Migration additive : profil `user_preferences.coaching`, matériel `exercise_progression.available_weights`, ressenti `workout_exercises.feedback`. Mêmes politiques par propriétaire, même RPC de sauvegarde `SECURITY INVOKER`, même garde de révision ; aucun droit anonyme ajouté. Anciennes lignes et payloads acceptés. Les types fixes/plages utilisent les bornes existantes. Les performances historiques ne sont pas recalculées ni réécrites. Le bouton d’application ne touche que les séries normales non réalisées et ne modifie jamais les objectifs.
