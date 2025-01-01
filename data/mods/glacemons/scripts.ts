export const Scripts: ModdedBattleScriptsData = {
	gen: 9,
	pokemon: {
		inherit: true,
		isGrounded(negateImmunity = false) {
			if ('gravity' in this.battle.field.pseudoWeather) return true;
			if ('ingrain' in this.volatiles && this.battle.gen >= 4) return true;
			if ('smackdown' in this.volatiles) return true;
			const item = (this.ignoringItem() ? '' : this.item);
			if (item === 'ironball' || item === 'knightsarmor') return true;
			// If a Fire/Flying type uses Burn Up and Roost, it becomes ???/Flying-type, but it's still grounded.
			if (!negateImmunity && this.hasType('Flying') && !(this.hasType('???') && 'roost' in this.volatiles)) return false;
			if (this.hasAbility('levitate') && !this.battle.suppressingAbility(this)) return null;
			if ('magnetrise' in this.volatiles) return false;
			if ('telekinesis' in this.volatiles) return false;
			return item !== 'airballoon';
		},
		runEffectiveness(move: ActiveMove) {
			let totalTypeMod = 0;
			for (const type of this.getTypes()) {
				let typeMod = this.battle.dex.getEffectiveness(move, type);
				typeMod = this.battle.singleEvent('Effectiveness', move, null, this, type, move, typeMod);
				totalTypeMod += this.battle.runEvent('Effectiveness', this, type, move, typeMod);
			}
			if (this.hasItem('Neutralizer') && totalTypeMod > 0) return 0;
			return totalTypeMod;
		},
	},

	actions: {
		inherit: true,
		modifyDamage(
			baseDamage: number, pokemon: Pokemon, target: Pokemon, move: ActiveMove, suppressMessages = false
		) {
			const tr = this.battle.trunc;
			if (!move.type) move.type = '???';
			const type = move.type;
	
			baseDamage += 2;
	
			if (move.spreadHit) {
				// multi-target modifier (doubles only)
				const spreadModifier = move.spreadModifier || (this.battle.gameType === 'freeforall' ? 0.5 : 0.75);
				this.battle.debug('Spread modifier: ' + spreadModifier);
				baseDamage = this.battle.modify(baseDamage, spreadModifier);
			} else if (move.multihitType === 'parentalbond' && move.hit > 1) {
				// Parental Bond modifier
				const bondModifier = this.battle.gen > 6 ? 0.25 : 0.5;
				this.battle.debug(`Parental Bond modifier: ${bondModifier}`);
				baseDamage = this.battle.modify(baseDamage, bondModifier);
			}
	
			// weather modifier
			baseDamage = this.battle.runEvent('WeatherModifyDamage', pokemon, target, move, baseDamage);
	
			// crit - not a modifier
			const isCrit = target.getMoveHitData(move).crit;
			if (isCrit) {
				baseDamage = tr(baseDamage * (move.critModifier || (this.battle.gen >= 6 ? 1.5 : 2)));
			}
	
			// random factor - also not a modifier
			baseDamage = this.battle.randomizer(baseDamage);
	
			// STAB
			// The "???" type never gets STAB
			// Not even if you Roost in Gen 4 and somehow manage to use
			// Struggle in the same turn.
			// (On second thought, it might be easier to get a MissingNo.)
			if (type !== '???') {
				let stab: number | [number, number] = 1;
	
				const isSTAB = move.forceSTAB || pokemon.hasType(type) || pokemon.getTypes(false, true).includes(type);
				if (isSTAB) {
					stab = 1.5;
				}
	
				// The Stellar tera type makes this incredibly confusing
				// If the move's type does not match one of the user's base types,
				// the Stellar tera type applies a one-time 1.2x damage boost for that type.
				//
				// If the move's type does match one of the user's base types,
				// then the Stellar tera type applies a one-time 2x STAB boost for that type,
				// and then goes back to using the regular 1.5x STAB boost for those types.
				if (pokemon.terastallized === 'Stellar') {
					if (!pokemon.stellarBoostedTypes.includes(type) || move.stellarBoosted) {
						stab = isSTAB ? 2 : [4915, 4096];
						move.stellarBoosted = true;
						if (pokemon.species.name !== 'Terapagos-Stellar') {
							pokemon.stellarBoostedTypes.push(type);
						}
					}
				} else {
					if (pokemon.terastallized === type && pokemon.getTypes(false, true).includes(type)) {
						stab = 2;
					}
					stab = this.battle.runEvent('ModifySTAB', pokemon, target, move, stab);
				}
	
				baseDamage = this.battle.modify(baseDamage, stab);
			}
	
			// types
			let typeMod = target.runEffectiveness(move);
			typeMod = this.battle.clampIntRange(typeMod, -6, 6);
			target.getMoveHitData(move).typeMod = typeMod;
			if (typeMod > 0) {
				if (!suppressMessages) this.battle.add('-supereffective', target);
	
				for (let i = 0; i < typeMod; i++) {
					baseDamage *= 2;
				}
			}
			if (typeMod < 0) {
				if (!suppressMessages) this.battle.add('-resisted', target);
	
				for (let i = 0; i > typeMod; i--) {
					baseDamage = tr(baseDamage / 2);
				}
			}
	
			if (isCrit && !suppressMessages) this.battle.add('-crit', target);
	
			if (pokemon.status === 'brn' && move.category === 'Physical' && !pokemon.hasAbility('guts')) {
				if (this.battle.gen < 6 || move.id !== 'facade') {
					baseDamage = this.battle.modify(baseDamage, 0.5);
				}
			}

			if (pokemon.status === 'frt' && move.category === 'Special') {
				if (this.battle.gen < 6 || move.id !== 'facade') {
					baseDamage = this.battle.modify(baseDamage, 0.5);
				}
			}
	
			// Generation 5, but nothing later, sets damage to 1 before the final damage modifiers
			if (this.battle.gen === 5 && !baseDamage) baseDamage = 1;
	
			// Final modifier. Modifiers that modify damage after min damage check, such as Life Orb.
			baseDamage = this.battle.runEvent('ModifyDamage', pokemon, target, move, baseDamage);
	
			if (move.isZOrMaxPowered && target.getMoveHitData(move).zBrokeProtect) {
				baseDamage = this.battle.modify(baseDamage, 0.25);
				this.battle.add('-zbroken', target);
			}
	
			// Generation 6-7 moves the check for minimum 1 damage after the final modifier...
			if (this.battle.gen !== 5 && !baseDamage) return 1;
	
			// ...but 16-bit truncation happens even later, and can truncate to 0
			return tr(baseDamage, 16);
		},

		canMegaEvo(pokemon) {
			const altForme = pokemon.baseSpecies.otherFormes && this.dex.species.get(pokemon.baseSpecies.otherFormes[0]);
			const item = pokemon.getItem();
			if (
			  altForme?.isMega && altForme?.requiredMove &&
			  pokemon.baseMoves.includes(this.dex.toID(altForme.requiredMove)) && !item.zMove
			) {
			  return altForme.name;
			}
			if (altForme?.isMega && (item.name === 'Parallel Mega Orb 0' || item.name === 'Parallel Mega Orb 1' || item.name === 'Parallel Mega Orb H')) {
				return altForme.name;
			}
			return item.megaStone;
		  },
	},

	init() {
		// Other Nerfs or Buffs
		delete this.modData('Learnsets', 'shaymin').learnset.grasswhistle;
		delete this.modData('Learnsets', 'goomy').learnset.curse;
		delete this.modData('Learnsets', 'sliggoo').learnset.curse;
		delete this.modData('Learnsets', 'goodra').learnset.curse;
		delete this.modData('Learnsets', 'sliggoohisui').learnset.curse;
		delete this.modData('Learnsets', 'goodrahisui').learnset.curse;
		// Slate 1 moves
		// Worry Seed
		this.modData('Learnsets', 'wochien').learnset.worryseed = ['9M'];
		// Pebble Storm
		this.modData('Learnsets', 'diancie').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'nacli').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'glimmet').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'ironboulder').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'terrakion').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'aerodactyl').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'archen').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'avalugghisui').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'rolycoly').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'roggenrola').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'ironthorns').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'rockruff').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'lycanrocdusk').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'minior').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'regirock').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'cranidos').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'stakataka').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'stonjourner').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'geodude').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'geodudealola').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'rhyhorn').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'houndstone').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'sandshrew').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'bombirdier').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'bramblin').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'silicobra').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'gligar').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'cacnea').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'diglett').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'diglettalola').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'sandygast').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'greattusk').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'donphan').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'landorus').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'gible').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'hippowdon').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'nosepass').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'carbink').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'onix').learnset.pebblestorm = ['9M'];
		this.modData('Learnsets', 'drilbur').learnset.pebblestorm = ['9M'];
		// Recover
		this.modData('Learnsets', 'celesteela').learnset.recover = ['9M'];
		this.modData('Learnsets', 'goomy').learnset.recover = ['9M'];
		this.modData('Learnsets', 'koffing').learnset.recover = ['9M'];
		this.modData('Learnsets', 'rotom').learnset.recover = ['9M'];
		this.modData('Learnsets', 'tympole').learnset.recover = ['9M'];
		this.modData('Learnsets', 'wochien').learnset.recover = ['9M'];
		// Shore Up
		this.modData('Learnsets', 'silicobra').learnset.shoreup = ['9M'];
		this.modData('Learnsets', 'mudkip').learnset.shoreup = ['9M'];
		// Roost
		this.modData('Learnsets', 'ironjugulis').learnset.roost = ['9M'];
		this.modData('Learnsets', 'articunogalar').learnset.roost = ['9M'];
		this.modData('Learnsets', 'zapdosgalar').learnset.roost = ['9M'];
		this.modData('Learnsets', 'moltresgalar').learnset.roost = ['9M'];
		// Slack Off
		this.modData('Learnsets', 'munchlax').learnset.slackoff = ['9M'];
		this.modData('Learnsets', 'numel').learnset.slackoff = ['9M'];
		this.modData('Learnsets', 'okidogi').learnset.slackoff = ['9M'];
		// Soft-Boiled
		this.modData('Learnsets', 'exeggcute').learnset.softboiled = ['9M'];
		// Salve Strike
		this.modData('Learnsets', 'tapukoko').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'tapubulu').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'tapufini').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'tapulele').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'swablu').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'fezandipiti').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'spritzee').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'azurill').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'eevee').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'shroomish').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'hoppip').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'cottonee').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'budew').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'gossifleur').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'petilil').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'fomantis').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'chikorita').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'deerling').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'happiny').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'snubbull').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'fidough').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'igglybuff').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'cleffa').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'ralts').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'enamorus').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'weezinggalar').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'togepi').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'chingling').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'sewaddle').learnset.salvestrike = ['9M'];
		this.modData('Learnsets', 'rapidashgalar').learnset.salvestrike = ['9M'];
		// Slate 1 adjustments
		this.modData('Learnsets', 'umbreon').learnset.knockoff = ['9M'];
		// this.modData('Learnsets', 'umbreon').learnset.scorchingsands = ['9M'];
		this.modData('Learnsets', 'umbreon').learnset.slackoff = ['9M'];
		this.modData("Learnsets", "silvally").learnset.knockoff = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.roost = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.stealthrock = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.closecombat = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.earthquake = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.stoneedge = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.boomburst = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.dragondance = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.healbell = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.taunt = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.trailblaze = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.hurricane = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.fireblast = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.thunder = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.blizzard = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.hydropump = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.focusblast = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.aurasphere = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.meteorbeam = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.refresh = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.aquatail = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.supercellslam = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.dazzlinggleam = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.seedbomb = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.gunkshot = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.psychic = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.waterpledge = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.firepledge = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.vacuumwave = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.quickattack = ['9L1'];
		this.modData("Learnsets", "silvally").learnset.disable = ['9L1'];
		this.modData("Learnsets", "kyurem").learnset.icepunch = ['9L1'];
		delete this.modData('Learnsets', 'kyurem').learnset.dragondance;
		delete this.modData('Learnsets', 'kyurem').learnset.iciclespear;
		delete this.modData('Learnsets', 'kyurem').learnset.scaleshot;
		this.modData("Learnsets", "kyuremblack").learnset.icepunch = ['9L1'];
		delete this.modData('Learnsets', 'kyuremblack').learnset.dragondance;
		delete this.modData('Learnsets', 'kyuremblack').learnset.iciclespear;
		delete this.modData('Learnsets', 'kyuremblack').learnset.scaleshot;
		// Slate 2 adjustments
		this.modData('Learnsets', 'enamorus').learnset.nastyplot = ['9M'];
		this.modData('Learnsets', 'enamorus').learnset.acrobatics = ['9M'];
		this.modData('Learnsets', 'enamorus').learnset.knockoff = ['9M'];
		this.modData("Learnsets", "enamorus").learnset.sludgewave = ['9L1'];
		this.modData("Learnsets", "enamorus").learnset.defog = ['9L1'];
		this.modData("Learnsets", "enamorus").learnset.skyattack = ['9L1'];
		this.modData("Learnsets", "enamorus").learnset.storedpower = ['9L1'];
		this.modData("Learnsets", "enamorus").learnset.morningsun = ['9L1'];
		this.modData("Learnsets", "genesect").learnset.firstimpression = ['9L1'];
		this.modData("Learnsets", "genesect").learnset.pounce = ['9L1'];
		delete this.modData('Learnsets', 'genesect').learnset.shiftgear;
		delete this.modData('Learnsets', 'genesect').learnset.honeclaws;
		delete this.modData('Learnsets', 'genesect').learnset.rockpolish;
		delete this.modData('Learnsets', 'genesect').learnset.selfdestruct;
		delete this.modData('Learnsets', 'genesect').learnset.explosion;
		this.modData("Learnsets", "necrozma").learnset.dracometeor = ['9L1'];
		this.modData("Learnsets", "necrozma").learnset.dragonclaw = ['9L1'];
		this.modData("Learnsets", "necrozma").learnset.psychicnoise = ['9L1'];
		this.modData("Learnsets", "necrozma").learnset.teleport = ['9L1'];
		this.modData("Learnsets", "necrozma").learnset.scaleshot = ['9L1'];
		this.modData("Learnsets", "skarmory").learnset.beakblast = ['9L1'];
		this.modData("Learnsets", "sceptile").learnset.glare = ['9L1'];
		this.modData("Learnsets", "sceptile").learnset.uturn = ['9L1'];
		this.modData("Learnsets", "sceptile").learnset.recover = ['9L1'];
		this.modData("Learnsets", "sceptile").learnset.aurasphere = ['9L1'];
		// twister 
		this.modData('Learnsets', 'exeggutoralola').learnset.twister = ['9L1'];
		this.modData('Learnsets', 'tatsugiri').learnset.twister = ['9L1'];
		this.modData('Learnsets', 'noibat').learnset.twister = ['9L1'];
		this.modData('Learnsets', 'noivern').learnset.twister = ['9L1'];
		this.modData('Learnsets', 'naganadel').learnset.twister = ['9L1'];
		this.modData('Learnsets', 'kommoo').learnset.twister = ['9L1'];
		this.modData('Learnsets', 'hydreigon').learnset.twister = ['9L1'];
		this.modData('Learnsets', 'silvally').learnset.twister = ['9L1'];
		this.modData('Learnsets', 'necrozma').learnset.twister = ['9L1'];
		// flameburst 
		this.modData('Learnsets', 'charcadet').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'armarouge').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'ceruledge').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'fennekin').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'braixen').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'delphox').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'houndour').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'houndoom').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'litleo').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'pyroar').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'moltres').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'scovillain').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'fuecoco').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'crocalor').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'skeledirge').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'volcanion').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'reshiram').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'heatran').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'chimchar').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'monferno').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'infernape').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'zebstrika').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'turtonator').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'flareon').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'ponyta').learnset.flameburst = ['9L1'];
		this.modData('Learnsets', 'rapidash').learnset.flameburst = ['9L1'];
		// beakblast 
		this.modData('Learnsets', 'vullaby').learnset.beakblast = ['9L1'];
		this.modData('Learnsets', 'mandibuzz').learnset.beakblast = ['9L1'];
		this.modData('Learnsets', 'fletchinder').learnset.beakblast = ['9L1'];
		this.modData('Learnsets', 'talonflame').learnset.beakblast = ['9L1'];
		this.modData('Learnsets', 'bombirdier').learnset.beakblast = ['9L1'];
		this.modData('Learnsets', 'honchkrow').learnset.beakblast = ['9L1'];
		this.modData('Learnsets', 'pelipper').learnset.beakblast = ['9L1'];
		this.modData('Learnsets', 'moltres').learnset.beakblast = ['9L1'];
		// railgun 
		this.modData('Learnsets', 'cufant').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'copperajah').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'celesteela').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'aron').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'lairon').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'aggron').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'beldum').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'metang').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'metagross').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'stakataka').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'onix').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'steelix').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'duraludon').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'archaludon').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'klink').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'klang').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'klinklang').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'orthworm').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'magnemite').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'magneton').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'magnezone').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'nosepass').learnset.railgun = ['9L1'];
		this.modData('Learnsets', 'probopass').learnset.railgun = ['9L1'];
		// mentalgymnastics 
		this.modData('Learnsets', 'deoxys').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'slowpoke').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'slowbro').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'slowking').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'slowpokegalar').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'slowbrogalar').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'slowkinggalar').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'hoopa').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'spoink').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'grumpig').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'smoochum').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'jynx').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'inkay').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'malamar').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'gothita').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'gothorita').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'gothitelle').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'exeggcute').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'exeggutor').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'mimejr').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'mrmime').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'drowzee').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'hypno').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'beldum').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'metang').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'metagross').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'azelf').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'uxie').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'mesprit').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'braviaryhisui').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'lugia').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'lunala').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'lunatone').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'solrock').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'meloetta').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'mew').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'oricorio').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'woobat').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'swoobat').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'baltoy').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'claydol').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'screamtail').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'psyduck').learnset.mentalgymnastics = ['9L1'];
		this.modData('Learnsets', 'golduck').learnset.mentalgymnastics = ['9L1'];
		// overvoltrail 
		this.modData('Learnsets', 'jolteon').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'mareep').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'flaaffy').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'ampharos').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'raikou').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'electrike').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'manectric').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'magnemite').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'magneton').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'magnezone').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'rotom').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'blitzle').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'zebstrika').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'tynamo').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'eelektrik').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'eelektross').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'charjabug').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'vikavolt').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'toxel').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'toxtricity').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'regieleki').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'sandyshocks').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'porygon').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'porygon2').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'porygonz').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'klink').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'klang').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'klinklang').learnset.overvoltrail = ['9L1'];
		this.modData('Learnsets', 'bellibolt').learnset.overvoltrail = ['9L1'];
		// Slate 3 adjustments
		this.modData('Learnsets', 'steelix').learnset.uturn = ['9M'];
		this.modData('Learnsets', 'steelix').learnset.shoreup = ['9M'];
		this.modData('Learnsets', 'steelix').learnset.anchorshot = ['9M'];
		this.modData("Learnsets", "steelix").learnset.glare = ['9L1'];
		this.modData("Learnsets", "steelix").learnset.spikes = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.return = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.rapidspin = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.morningsun = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.uturn = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.flareblitz = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.willowisp = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.liquidation = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.playrough = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.moonblast = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.spiritbreak = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.salvestrike = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.aquajet = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.partingshot = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.taunt = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.flamethrower = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.fireblast = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.hydropump = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.refresh = ['9L1'];
		this.modData("Learnsets", "taurospaldeacombat").learnset.slackoff = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.return = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.rapidspin = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.morningsun = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.uturn = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.flareblitz = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.willowisp = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.liquidation = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.playrough = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.moonblast = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.spiritbreak = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.salvestrike = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.aquajet = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.partingshot = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.taunt = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.flamethrower = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.fireblast = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.hydropump = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.refresh = ['9L1'];
		this.modData("Learnsets", "taurospaldeablaze").learnset.slackoff = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.return = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.rapidspin = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.morningsun = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.uturn = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.flareblitz = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.willowisp = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.liquidation = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.playrough = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.moonblast = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.spiritbreak = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.salvestrike = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.aquajet = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.partingshot = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.taunt = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.flamethrower = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.fireblast = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.hydropump = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.refresh = ['9L1'];
		this.modData("Learnsets", "taurospaldeaaqua").learnset.slackoff = ['9L1'];
		this.modData("Learnsets", "wochien").learnset.spiritshackle = ['9L1'];
		this.modData("Learnsets", "wochien").learnset.shadowball = ['9L1'];
		this.modData("Learnsets", "wochien").learnset.poltergeist = ['9L1'];
		this.modData("Learnsets", "wochien").learnset.toxic = ['9L1'];
		this.modData("Learnsets", "wochien").learnset.destinybond = ['9L1'];
		this.modData("Learnsets", "wochien").learnset.curse = ['9L1'];
		this.modData("Learnsets", "wochien").learnset.nightshade = ['9L1'];
		this.modData("Learnsets", "wochien").learnset.healblock = ['9L1'];
		this.modData("Learnsets", "wochien").learnset.psyshock = ['9L1'];
		delete this.modData('Learnsets', 'wochien').learnset.leafstorm;
		delete this.modData('Learnsets', 'wochien').learnset.bulletseed;
		delete this.modData('Learnsets', 'wochien').learnset.magicalleaf;
		delete this.modData('Learnsets', 'wochien').learnset.energyball;
		delete this.modData('Learnsets', 'wochien').learnset.megadrain;
		delete this.modData('Learnsets', 'wochien').learnset.ingrain;
		delete this.modData('Learnsets', 'wochien').learnset.powerwhip;
		delete this.modData('Learnsets', 'wochien').learnset.solarblade;
		delete this.modData('Learnsets', 'wochien').learnset.grassyterrain;
		this.modData("Learnsets", "magearna").learnset.salvestrike = ['9L1'];
		delete this.modData('Learnsets', 'magearna').learnset.calmmind;
		delete this.modData('Learnsets', 'magearna').learnset.storedpower;
		this.modData("Learnsets", "glaceon").learnset.slackoff = ['9L1'];
		this.modData("Learnsets", "glaceon").learnset.earthpower = ['9L1'];
		this.modData("Learnsets", "glaceon").learnset.scorchingsands = ['9L1'];
		this.modData("Learnsets", "glaceon").learnset.chargebeam = ['9L1'];
		this.modData("Learnsets", "glaceon").learnset.stealthrock = ['9L1'];
		this.modData("Learnsets", "manectric").learnset.fireblast = ['9L1'];
		this.modData("Learnsets", "manectric").learnset.willowisp = ['9L1'];
		this.modData("Learnsets", "manectric").learnset.taunt = ['9L1'];
		this.modData("Learnsets", "manectric").learnset.morningsun = ['9L1'];
		this.modData("Learnsets", "manectric").learnset.sunnyday = ['9L1'];
		this.modData("Learnsets", "manectric").learnset.firespin = ['9L1'];
		this.modData("Learnsets", "manectric").learnset.heatwave = ['9L1'];
		this.modData("Learnsets", "manectric").learnset.flareblitz = ['9L1'];
		this.modData("Learnsets", "manectric").learnset.solarbeam = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.iceshard = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.brickbreak = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.doublekick = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.focusblast = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.reversal = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.revenge = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.counter = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.liquidation = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.haze = ['9L1'];
		this.modData("Learnsets", "avalugg").learnset.stealthrock = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.iceshard = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.brickbreak = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.doublekick = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.focusblast = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.reversal = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.revenge = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.counter = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.liquidation = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.haze = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.swordsdance = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.spikes = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.earthpower = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.thunderfang = ['9L1'];
		this.modData("Learnsets", "avalugghisui").learnset.psychicfangs = ['9L1'];
		// Night Slash
		this.modData('Learnsets', 'lokix').learnset.nightslash = ['9L1'];
		this.modData('Learnsets', 'silvally').learnset.nightslash = ['9L1'];
		this.modData('Learnsets', 'chienpao').learnset.nightslash = ['9L1'];
		this.modData('Learnsets', 'chiyu').learnset.nightslash = ['9L1'];
		this.modData('Learnsets', 'tinglu').learnset.nightslash = ['9L1'];
		this.modData('Learnsets', 'wochien').learnset.nightslash = ['9L1'];
		// Psycho Cut
		this.modData('Learnsets', 'deoxys').learnset.psychocut = ['9L1'];
		this.modData('Learnsets', 'jirachi').learnset.psychocut = ['9L1'];
		this.modData('Learnsets', 'silvally').learnset.psychocut = ['9L1'];
		// Self-Repair
		this.modData('Learnsets', 'aron').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'lairon').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'aggron').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'beldum').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'metang').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'metagross').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'duraludon').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'archaludon').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'bronzor').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'bronzong').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'cobalion').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'dialga').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'genesect').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'geodudealola').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'graveleralola').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'golemalola').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'ironboulder').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'ironbundle').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'ironcrown').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'ironhands').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'ironjugulis').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'ironleaves').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'ironthorns').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'irontreads').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'ironvaliant').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'klang').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'klinklang').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'magearna').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'magnemite').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'meltan').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'regice').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'regirock').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'registeel').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'revavroom').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'rotom').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'shieldon').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'bastiodon').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'tinkaton').learnset.selfrepairing = ['9L1'];
		// Spectral Thief
		this.modData('Learnsets', 'drifloon').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'drifblim').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'basculegion').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'basculegionf').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'silvally').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'pecharunt').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'skeledirge').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'shuppet').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'banette').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'dhelmise').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'golett').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'golurk').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'bramblin').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'brambleghast').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'hoopa').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'phantump').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'trevenant').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'decidueye').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'greavard').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'houndstone').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'zorua').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'zoroark').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'zoruahisui').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'zoroarkhisui').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'yamask').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'cofagrigus').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'yamaskgalar').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'runerigus').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'dusclops').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'dusknoir').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'sableye').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'pumpkaboo').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'gourgeist').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'marowakalola').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'spiritomb').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'frillish').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'jellicent').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'mimikyu').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'corsolagalar').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'wochien').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'dreepy').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'drakloak').learnset.spectralthief = ['9L1'];
		this.modData('Learnsets', 'dragapult').learnset.spectralthief = ['9L1'];
		// Gravel Grater
		this.modData('Learnsets', 'nacli').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'naclstack').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'garganacl').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'cranidos').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'rampardos').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'larvitar').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'pupitar').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'archen').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'archeops').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'rhyhorn').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'rhydon').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'rhyperior').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'kleavor').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'roggenrola').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'boldore').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'gigalith').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'ironthorns').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'stakataka').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'terrakion').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'avalugghisui').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'anorith').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'armaldo').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'stonjourner').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'tyrunt').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'tyrantrum').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'ironboulder').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'geodude').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'graveler').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'golem').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'geodudealola').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'graveleralola').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'golemalola').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'rockruff').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'lycanroc').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'lycanrocmidnight').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'lycanrocdusk').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'growlithehisui').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'arcaninehisui').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'drednaw').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'kabuto').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'kabutops').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'aron').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'lairon').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'aggron').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'tirtouga').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'carracosta').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'binacle').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'barbaracle').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'dwebble').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'crustle').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'klawf').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'minior').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'regirock').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'bonsly').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'sudowoodo').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'relicanth').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'rolycoly').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'carkol').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'coalossal').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'lileep').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'cradily').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'nosepass').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'probopass').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'magcargo').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'gible').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'gabite').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'garchomp').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'ursaluna').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'greattusk').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'mamoswine').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'mudbray').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'mudsdale').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'onix').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'steelix').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'golett').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'golurk').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'phanpy').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'donphan').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'sandile').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'krokorok').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'bombirdier').learnset.gravelgrater = ['9L1'];
		// Flex Off
		this.modData('Learnsets', 'conkeldurr').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'darmanitan').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'rhydon').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'rhyperior').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'buzzwole').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'escavalier').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'ironthorns').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'tyranitar').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'crabominable').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'beartic').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'breloom').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'machop').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'machoke').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'machamp').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'tapubulu').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'ursaring').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'ursaluna').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'okidogi').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'armaldo').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'bewear').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'golisopod').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'sawk').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'throh').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'pangoro').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'braviary').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'electivire').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'pignite').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'emboar').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'crawdaunt').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'golem').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'grimmsnarl').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'hariyama').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'quaquaval').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'tsareena').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'grapploct').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'krookodile').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'incineroar').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'lycanrocmidnight').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'zangoose').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'gumshoos').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'chesnaught').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'tyrogue').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'hitmonlee').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'hitmonchan').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'hitmontop').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'primeape').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'annihilape').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'infernape').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'dusknoir').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'landorus').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'tornadus').learnset.flexoff = ['9L1'];
		this.modData('Learnsets', 'thundurus').learnset.flexoff = ['9L1'];
		// Ion Saw
		this.modData('Learnsets', 'ceruledge').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'ironvaliant').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'pawniard').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'bisharp').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'kingambit').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'honedge').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'doublade').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'aegislash').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'axew').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'fraxure').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'kleavor').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'absol').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'gallade').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'kabutops').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'ironhands').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'ironthorns').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'elekid').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'electabuzz').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'electivire').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'golemalola').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'luxray').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'eelektross').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'thundurus').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'pincurchin').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'togedemaru').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'morpeko').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'charjabug').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'vikavolt').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'ironcrown').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'ironboulder').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'ironleaves').learnset.ionsaw = ['9L1'];
		this.modData('Learnsets', 'zebstrika').learnset.ionsaw = ['9L1'];
		// Land's Wrath
		this.modData('Learnsets', 'nidoqueen').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'nidoking').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'diglett').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'dugtrio').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'diglettalola').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'dugtrioalola').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'geodude').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'graveler').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'golemalola').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'onix').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'steelix').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'ursaluna').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'ursalunabloodmoon').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'rhyhorn').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'rhydon').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'rhyperior').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'wooper').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'quagsire').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'wooperpaldea').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'clodsire').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'gligar').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'gliscor').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'swinub').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'piloswine').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'mamoswine').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'larvitar').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'pupitar').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'tyranitar').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'phanpy').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'donphan').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'mudkip').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'marshtomp').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'swampert').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'nincada').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'ninjask').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'shedinja').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'numel').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'camerupt').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'trapinch').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'vibrava').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'flygon').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'barboach').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'whiscash').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'baltoy').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'claydol').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'gible').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'gabite').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'garchomp').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'hippopotas').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'hippowdon').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'drilbur').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'excadrill').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'golett').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'landorus').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'groudon').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'gougingfire').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'arceus').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'mudsdale').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'sandygast').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'palossand').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'silicobra').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'greattusk').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'irontreads').learnset.landswrath = ['9L1'];
		this.modData('Learnsets', 'tinglu').learnset.landswrath = ['9L1'];
		// Slate 4
		this.modData('Learnsets', 'haxorus').learnset.steelbeam = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.heavyslam = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.hardpress = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.smartstrike = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.flashcannon = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.metalclaw = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.magnetrise = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.thunderwave = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.dragonrush = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.crosschop = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.megahorn = ['9L1'];
		this.modData('Learnsets', 'haxorus').learnset.stoneedge = ['9L1'];
		this.modData('Learnsets', 'drapion').learnset.barbbarrage = ['9L1'];
		this.modData('Learnsets', 'drapion').learnset.beatup = ['9L1'];
		this.modData('Learnsets', 'drapion').learnset.coil = ['9L1'];
		this.modData('Learnsets', 'drapion').learnset.crosschop = ['9L1'];
		this.modData('Learnsets', 'drapion').learnset.gunkshot = ['9L1'];
		this.modData('Learnsets', 'drapion').learnset.jawlock = ['9L1'];
		this.modData('Learnsets', 'drapion').learnset.shoreup = ['9L1'];
		this.modData('Learnsets', 'drapion').learnset.suckerpunch = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.refresh = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.recover = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.healbell = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.earthquake = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.stealthrock = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.smackdown = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.stoneedge = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.powergem = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.partingshot = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.meteorbeam = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.hurricane = ['9L1'];
		this.modData('Learnsets', 'goodra').learnset.liquidation = ['9L1'];
		this.modData('Learnsets', 'goodra').learnset.wavecrash = ['9L1'];
		this.modData('Learnsets', 'goodra').learnset.poisonjab = ['9L1'];
		this.modData('Learnsets', 'goodra').learnset.dragonhammer = ['9L1'];
		this.modData('Learnsets', 'golisopod').learnset.headlongrush = ['9L1'];
		this.modData('Learnsets', 'golisopod').learnset.slackoff = ['9L1'];
		this.modData('Learnsets', 'golisopod').learnset.wavecrash = ['9L1'];
		this.modData('Learnsets', 'golisopod').learnset.spikyshield = ['9L1'];
		// triattack 
		this.modData('Learnsets', 'arceus').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'audino').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'castform').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'chatot').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'delcatty').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'drampa').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'dunsparce').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'grafaiai').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'helioptile').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'hoothoot').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'indeedee').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'indeedeef').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'lickitung').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'oranguru').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'persian').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'pidgeotto').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'pyroar').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'spinda').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'ursalunabloodmoon').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'smoliv').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'toxel').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'whismur').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'patrat').learnset.triattack = ['9L1'];
		this.modData('Learnsets', 'zoruahisui').learnset.triattack = ['9L1'];
		// squall 
		this.modData('Learnsets', 'charizard').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'rookidee').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'dragonite').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'enamorus').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'gligar').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'landorus').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'moltres').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'wingull').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'silvally').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'skarmory').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'zapdos').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'gyarados').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'thundurus').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'tornadus').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'celesteela').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'zapdosgalar').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'articunogalar').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'moltresgalar').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'articuno').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'moltres').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'aerodactyl').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'hawlucha').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'salamence').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'swablu').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'archen').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'cramorant').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'drifloon').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'murkrow').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'ironjugulis').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'jumpluff').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'wattrel').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'vullaby').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'mantyke').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'noibat').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'pidgey').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'starly').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'taillow').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'fletchling').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'tropius').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'lugia').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'hooh').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'rayquaza').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'arceus').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'reshiram').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'zekrom').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'kyurem').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'yveltal').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'roaringmoon').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'snom').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'froslass').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'vanillite').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'snover').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'amaura').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'cryogonal').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'delibird').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'trapinch').learnset.squall = ['9L1'];
		this.modData('Learnsets', 'scyther').learnset.squall = ['9L1'];
		// petroleumblast 
		this.modData('Learnsets', 'diancie').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'nacli').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'glimmet').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'silvally').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'larvitar').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'aron').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'numel').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'anorith').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'lileep').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'amaura').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'shieldon').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'rolycoly').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'roggenrola').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'geodude').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'geodudealola').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'lunatone').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'nihilego').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'solrock').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'omanyte').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'cranidos').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'greattusk').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'irontreads').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'ironthorns').learnset.petroleumblast = ['9L1'];
		this.modData('Learnsets', 'onix').learnset.petroleumblast = ['9L1'];
		// poisonfang 
		this.modData('Learnsets', 'weedle').learnset.poisonfang = ['9L1'];
		this.modData('Learnsets', 'nidoranm').learnset.poisonfang = ['9L1'];
		this.modData('Learnsets', 'bulbasaur').learnset.poisonfang = ['9L1'];
		// fishiousrend 
		this.modData('Learnsets', 'carvanha').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'arrokuda').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'basculin').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'basculegion').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'basculegionf').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'bidoof').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'bruxish').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'cramorant').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'chewtle').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'huntail').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'qwilfish').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'qwilfishhisui').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'totodile').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'kyogre').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'veluza').learnset.fishiousrend = ['9L1'];
		this.modData('Learnsets', 'wishiwashi').learnset.fishiousrend = ['9L1'];
		// hyperfang 
		this.modData('Learnsets', 'riolu').learnset.hyperfang = ['9L1'];
		this.modData('Learnsets', 'mienfoo').learnset.hyperfang = ['9L1'];
		this.modData('Learnsets', 'okidogi').learnset.hyperfang = ['9L1'];
		this.modData('Learnsets', 'passimian').learnset.hyperfang = ['9L1'];
		this.modData('Learnsets', 'pawmi').learnset.hyperfang = ['9L1'];
		this.modData('Learnsets', 'slitherwing').learnset.hyperfang = ['9L1'];
		this.modData('Learnsets', 'scraggy').learnset.hyperfang = ['9L1'];
		this.modData('Learnsets', 'zamazenta').learnset.hyperfang = ['9L1'];
		//slate 5
		//pecharunt's moves
		this.modData('Learnsets', 'pecharunt').learnset.banefulbunker = ['9L1'];
		this.modData('Learnsets', 'pecharunt').learnset.toxicspikes = ['9L1'];
		this.modData('Learnsets', 'pecharunt').learnset.earthpower = ['9L1'];
		this.modData('Learnsets', 'pecharunt').learnset.thunderwave = ['9L1'];
		this.modData('Learnsets', 'pecharunt').learnset.knockoff = ['9L1'];
		this.modData('Learnsets', 'pecharunt').learnset.mortalspin = ['9L1'];
		//mantine's moves
		this.modData('Learnsets', 'mantine').learnset.dragontail = ['9L1'];
		this.modData('Learnsets', 'mantine').learnset.flipturn = ['9L1'];
		this.modData('Learnsets', 'mantine').learnset.healbell = ['9L1'];
		this.modData('Learnsets', 'mantine').learnset.knockoff = ['9L1'];
		this.modData('Learnsets', 'mantine').learnset.refresh = ['9L1'];
		this.modData('Learnsets', 'mantine').learnset.snatch = ['9L1'];
		//paradox mons's moves
		this.modData('Learnsets', 'ragingbolt').learnset.paraboliccharge = ['9L1'];
		this.modData('Learnsets', 'sandyshocks').learnset.rapidspin = ['9L1'];
		this.modData('Learnsets', 'sandyshocks').learnset.shoreup = ['9L1'];
		this.modData('Learnsets', 'sandyshocks').learnset.weatherball = ['9L1'];
		this.modData('Learnsets', 'screamtail').learnset.teleport = ['9L1'];
		this.modData('Learnsets', 'fluttermane').learnset.healingwish = ['9L1'];
		this.modData('Learnsets', 'roaringmoon').learnset.defog = ['9L1'];
		this.modData('Learnsets', 'roaringmoon').learnset.partingshot = ['9L1'];
		this.modData('Learnsets', 'walkingwake').learnset.taunt = ['9L1'];
		this.modData('Learnsets', 'gougingfire').learnset.willowisp = ['9L1'];
		this.modData('Learnsets', 'ironvaliant').learnset.salvestrike = ['9L1'];
		this.modData('Learnsets', 'ironboulder').learnset.explosion = ['9L1'];
		this.modData('Learnsets', 'ironboulder').learnset.stealthrock = ['9L1'];
		this.modData('Learnsets', 'ironmoth').learnset.selfrepairing = ['9L1'];
		this.modData('Learnsets', 'ironmoth').learnset.willowisp = ['9L1'];
		this.modData('Learnsets', 'ironleaves').learnset.powerwhip = ['9L1'];
		this.modData('Learnsets', 'ironleaves').learnset.uturn = ['9L1'];
		this.modData('Learnsets', 'ironjugulis').learnset.defog = ['9L1'];
		this.modData('Learnsets', 'ironthorns').learnset.knockoff = ['9L1'];
		this.modData('Learnsets', 'ironbundle').learnset.surf = ['9L1'];
		// quicksanddrain 
		this.modData('Learnsets', 'wooper').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'wooperpaldea').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'diancie').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'gible').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'nacli').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'glaceon').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'gligar').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'greattusk').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'heatran').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'irontreads').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'landorus').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'shaymin').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'steelix').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'larvitar').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'drilbur').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'hippopotas').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'swinub').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'tinglu').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'aerodactyl').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'mew').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'aron').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'archen').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'anorith').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'binacle').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'shieldon').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'numel').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'tirtouga').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'baltoy').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'dwebble').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'diggersby').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'phanpy').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'diglett').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'diglettalola').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'trapinch').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'roggenrola').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'geodude').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'geodudealola').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'golett').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'guzzlord').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'ironthorns').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'sandile').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'cubone').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'mudbray').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'orthworm').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'sandygast').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'nosepass').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'regirock').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'rhyhorn').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'silicobra').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'stunfisk').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'sudowoodo').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'marshtomp').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'toedscool').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'whiscash').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'groudon').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'arceus').learnset.quicksanddrain = ['9L1'];
		this.modData('Learnsets', 'zygarde').learnset.quicksanddrain = ['9L1'];
		// scythelimbs 
		this.modData('Learnsets', 'kabutops').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'ceruledge').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'gabite').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'genesect').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'gligar').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'wimpod').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'axew').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'kartana').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'pawniard').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'sneasel').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'skarmory').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'necrozma').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'scyther').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'nincada').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'pinsir').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'honedge').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'beedrill').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'gallade').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'heracross').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'ironboulder').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'ironleaves').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'mew').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'scolipede').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'spinarak').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'vespiquen').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'anorith').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'binacle').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'carnivine').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'dwebble').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'durant').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'escavalier').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'krabby').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'klawf').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'fomantis').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'leavanny').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'nymble').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'mimikyu').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'sandshrew').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'sandshrewalola').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'virizion').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'terrakion').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'cobalion').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'keldeo').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'zangoose').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'arceus').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'baxcalibur').learnset.scythelimbs = ['9L1'];
		this.modData('Learnsets', 'dreepy').learnset.scythelimbs = ['9L1'];
		// chickendance 
		this.modData('Learnsets', 'dragonite').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'spritzee').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'fuecoco').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'torchic').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'rufflet').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'taillow').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'murkrow').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'tapukoko').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'articuno').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'zapdos').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'moltres').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'articunogalar').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'zapdosgalar').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'moltresgalar').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'hoothoot').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'wingull').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'swablu').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'quaxly').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'oricorio').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'flittle').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'archen').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'delibird').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'bombirdier').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'hawlucha').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'chatot').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'cramorant').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'doduo').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'piplup').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'natu').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'rowlet').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'ducklett').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'pidgey').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'bonsly').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'dunsparce').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'silvally').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'munkidori').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'fezandipiti').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'okidogi').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'pecharunt').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'hooh').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'arceus').learnset.chickendance = ['9L1'];
		this.modData('Learnsets', 'calyrex').learnset.chickendance = ['9L1'];
		// chakrabullets 
		this.modData('Learnsets', 'deoxys').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'hatterene').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'ironcrown').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'ironvaliant').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'magearna').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'necrozma').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'tapulele').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'terapagos').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'zamazenta').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'combusken').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'hoopa').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'latios').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'meditite').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'spoink').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'kadabra').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'ralts').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'heracross').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'keldeo').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'gothita').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'zeraora').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'victini').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'jirachi').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'mew').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'terrakion').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'oranguru').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'armarouge').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'azelf').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'braviaryhisui').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'breloom').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'celebi').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'cobalion').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'cresselia').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'mankey').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'espeon').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'grapploct').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'lucario').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'meloetta').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'mesprit').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'hoopa').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'mienfoo').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'mimejr').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'munkidori').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'solosis').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'screamtail').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'slowpoke').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'slowpokegalar').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'virizion').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'mewtwo').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'dialga').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'palkia').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'giratina').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'arceus').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'solgaleo').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'lunala').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'palafin').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'xerneas').learnset.chakrabullets = ['9L1'];
		this.modData('Learnsets', 'latias').learnset.chakrabullets = ['9L1'];
		// Slate 5 adjustments
		this.modData('Learnsets', 'zeraora').learnset.gravelgrater = ['9L1'];
		this.modData('Learnsets', 'zeraora').learnset.pursuit = ['9L1'];
		this.modData('Learnsets', 'zeraora').learnset.accelerock = ['9L1'];
		this.modData('Learnsets', 'zeraora').learnset.stealthrock = ['9L1'];
		this.modData('Learnsets', 'zeraora').learnset.stoneedge = ['9L1'];
		this.modData('Learnsets', 'zeraora').learnset.ancientpower = ['9L1'];
		this.modData('Learnsets', 'zeraora').learnset.rocktomb = ['9L1'];
		this.modData('Learnsets', 'zeraora').learnset.pebblestorm = ['9L1'];
		this.modData('Learnsets', 'incineroar').learnset.victorydance = ['9L1'];
		this.modData('Learnsets', 'incineroar').learnset.suckerpunch = ['9L1'];
		this.modData('Learnsets', 'incineroar').learnset.wickedblow = ['9L1'];
		this.modData('Learnsets', 'hippowdon').learnset.taunt = ['9L1'];
		this.modData('Learnsets', 'gengar').learnset.icebeam = ['9L1'];
		this.modData('Learnsets', 'gengar').learnset.partingshot = ['9L1'];
		this.modData('Learnsets', 'obstagoon').learnset.fakeout = ['9L1'];
		this.modData('Learnsets', 'obstagoon').learnset.extremespeed = ['9L1'];
		this.modData('Learnsets', 'obstagoon').learnset.toxic = ['9L1'];
	}
};
