# Propositions d’entraînement

Le moteur utilise des règles explicites et affiche les éléments retenus dans « Pourquoi cette proposition ? ». Ces seuils sont des choix de produit conservateurs, pas un modèle médical ou une prédiction validée de fatigue.

## Données utilisées

- Dernières séances terminées de l’exercice, limitées par le réglage d’historique, sans la séance en cours ni les dates futures.
- Séries normales toutes réalisées, même nombre de séries, mode de charge et fourchette compatibles. Un changement entre exercice isolé et superset, ou de partenaires de superset, interrompt la comparaison. Une occurrence répartie en plusieurs blocs n’est pas traitée comme plusieurs séances : aucune proposition chiffrée n’est créée lorsqu’on ne peut pas aligner les blocs sans ambiguïté.
- Repos réellement renseignés, y compris le repos par tour de superset. Un écart supérieur à 25 % et 30 secondes suspend la comparaison concernée. Des repos absents ne sont pas inventés.
- Échecs déclarés sur toutes les séries musculaires réalisées, y compris échauffement/dégressive ; ces deux derniers types restent exclus du calcul de performance comparable. Une case vide signifie absence de déclaration, pas une mesure des répétitions en réserve.

## Plan par série

Une répétition supplémentaire au total est proposée lorsque la fourchette est partiellement atteinte. Les charges différentes selon les séries sont conservées. Pour proposer le palier suivant, il faut deux occurrences consécutives au haut de la fourchette, aux mêmes charges, technique validée et sans échec déclaré ni ancien seuil RPE/RIR dépassé. Les répétitions repartent alors de la borne basse. L’incrément est celui configuré ; une augmentation supérieure à 10 % d’une charge ou dépassant 2 000 kg est suspendue et demande d’ajuster le réglage, sans inventer le matériel disponible.

Sur machine assistée, le palier réduit les kilogrammes d’aide, avec un plancher de zéro. Au poids du corps, seules les répétitions sont proposées ; aucun poids corporel ni lest n’est déduit. Le cardio reste hors de ce moteur.

Deux baisses successives comparables de l’exercice signalent une tendance à confirmer. Un plateau peut proposer une seule répétition supplémentaire. Une baisse isolée ne devient pas un diagnostic. Un changement opposé de charge et de répétitions est considéré comme ambigu ; les performances ne sont pas résumées par un 1RM inventé pour toutes les machines.

## Autres exercices et séance du jour

- Sur les six dernières semaines, chaque autre exercice est comparé à lui-même sur trois occurrences. Il faut au moins deux exercices en baisse sur leurs deux comparaisons et une majorité parmi les exercices évaluables pour modérer une hausse.
- Dans la séance en cours, seuls les exercices placés avant l’exercice étudié sont retenus. Deux exercices terminés en baisse par rapport à leur propre dernière occurrence comparable, ou au moins deux séries à l’échec sur des muscles également sollicités ici, modèrent la hausse.
- Un échec déclaré sur l’exercice en cours retire immédiatement le plan de hausse pour les séries restantes.
- Une tendance favorable des autres exercices n’impose jamais une hausse. Les absences de données sont indiquées. Les kilogrammes de deux exercices distincts ne sont jamais comparés directement.

Ces nombres (3 %, six semaines, deux confirmations, etc.) sont des heuristiques documentées et testées. Ils ne prouvent pas une relation de cause à effet entre exercices. Les essais sur l’échec montrent des différences de fatigue aiguë selon les protocoles et populations ; ils ne valident pas ce moteur : [essai randomisé à volume égalisé](https://pmc.ncbi.nlm.nih.gov/articles/PMC7327779/), [essai sur marqueurs de fatigue](https://pubmed.ncbi.nlm.nih.gov/33306589/).

## Application volontaire et conservation

Le bouton d’application renseigne uniquement les séries normales non réalisées. Les séries validées, échauffements et dégressives restent intactes. Une confirmation protège les saisies déjà présentes. Aucune série n’est modifiée automatiquement. Le flag d’échec est sauvegardé par la RPC transactionnelle et sous les mêmes politiques RLS que les autres mesures ; copies et modèles repartent sans échec déclaré. Les anciens payloads restent acceptés, avec `false` par défaut.
