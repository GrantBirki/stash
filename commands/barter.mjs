import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import gameData from '../modules/game-data.mjs';
import progress from '../modules/progress-shard.mjs';
import { getFixedT, getCommandLocalizations } from '../modules/translations.mjs';

const MAX_BARTERS = 3;

const defaultFunction = {
    data: new SlashCommandBuilder()
        .setName('barter')
        .setDescription('Find barters with a specific item')
        .setNameLocalizations(getCommandLocalizations('barter'))
        .setDescriptionLocalizations(getCommandLocalizations('barter_desc'))
        .addStringOption(option => option
            .setName('name')
            .setDescription('Item name to search for')
            .setNameLocalizations(getCommandLocalizations('name'))
            .setDescriptionLocalizations(getCommandLocalizations('name_search_desc'))
            .setAutocomplete(true)
            .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply();
        const locale = await progress.getServerLanguage(interaction.guildId) || interaction.locale;
        const t = getFixedT(locale);
        const searchString = interaction.options.getString('name');

        if (!searchString) {
            return interaction.editReply({
                content: t('You need to specify a search term'),
                ephemeral: true,
            });
        }

        const matchedBarters = [];

        const [items, barters, traders] = await Promise.all([
            gameData.items.getAll(locale),
            gameData.barters.getAll(),
            gameData.traders.getAll(locale)
        ]);
        const searchedItems = items.filter(item => item.name.toLowerCase().includes(searchString.toLowerCase()));

        for (const item of searchedItems) {
            for (const barter of item.bartersFor) {
                if (matchedBarters.includes(barter.id)) continue;
                matchedBarters.push(barter.id);
            }
            for (const barter of item.bartersUsing) {
                if (matchedBarters.includes(barter.id)) continue;
                matchedBarters.push(barter.id);
            }
        }

        if (matchedBarters.length === 0) {
            return interaction.editReply({
                content: t(`Found no results for "{{searchString}}"`, {
                    searchString: searchString
                }),
                ephemeral: true,
            });
        }

        let embeds = [];

        const prog = await progress.getSafeProgress(interaction.user.id);

        for (let i = 0; i < matchedBarters.length; i = i + 1) {
            const barter = barters.find(b => b.id === matchedBarters[i]);
            let totalCost = 0;
            const embed = new EmbedBuilder();

            const rewardItem = items.find(it => it.id === barter.rewardItems[0].item.id);
            let title = rewardItem.name;

            if (barter.rewardItems[0].count > 1) {
                title += " (" + barter.rewardItems[0].count + ")";
            }

            const locked = prog.traders[barter.trader.id] < barter.level ? '🔒' : '';
            title += `\r\n ${traders.find(tr => tr.id === barter.trader.id).name} ${t('LL')}${barter.level}${locked}`;
            embed.setTitle(title);
            embed.setURL(`${rewardItem.link}#${i}`);

            if (rewardItem.iconLink) {
                embed.setThumbnail(rewardItem.iconLink);
            }

            for (const req of barter.requiredItems) {
                const reqItem = items.find(i => i.id === req.item.id);
                let itemCost = reqItem.avg24hPrice;

                if (reqItem.lastLowPrice > itemCost && reqItem.lastLowPrice > 0) {
                    itemCost = reqItem.lastLowPrice;
                }

                for (const offer of reqItem.buyFor) {
                    if (!offer.vendor.trader) {
                        continue;
                    }
                    let traderPrice = offer.priceRUB;

                    if ((traderPrice < itemCost && prog.traders[offer.vendor.trader.id] >= offer.vendor.minTraderLevel) || itemCost == 0) {
                        itemCost = traderPrice;
                    }
                }

                let bestSellPrice = 0;
                for (const offer of reqItem.sellFor) {
                    if (!offer.vendor.trader) {
                        continue;
                    }
                    if (offer.priceRUB > bestSellPrice) {
                        bestSellPrice = offer.priceRUB;
                    }
                }

                let reqName = reqItem.name;
                if (itemCost === 0) {
                    itemCost = bestSellPrice;

                    const isDogTag = req.attributes.some(att => att.name === 'minLevel');
                    if (isDogTag) {
                        const tagLevel = req.attributes.find(att => att.name === 'minLevel').value;
                        itemCost = bestSellPrice * tagLevel;
                        reqName += ' >= '+tagLevel;
                    }
                }

                totalCost += itemCost * req.count;
                embed.addFields({name: reqName, value: itemCost.toLocaleString(locale) + "₽ x " + req.count, inline: true});
            }

            embed.addFields({name: t('Total'), value: totalCost.toLocaleString(locale) + "₽", inline: false});

            embeds.push(embed);

            if (i == MAX_BARTERS - 1) {
                break;
            }
        }

        if (matchedBarters.length > MAX_BARTERS) {
            const ending = new EmbedBuilder();

            ending.setTitle("+" + (matchedBarters.length - MAX_BARTERS) + ` ${t('more')}`);
            ending.setURL("https://tarkov.dev/barters/?search=" + encodeURIComponent(searchString));

            let otheritems = '';

            for (let i = MAX_BARTERS; i < matchedBarters.length; i = i + 1) {
                const barter = barters.find(b => b.id === matchedBarters[i]);
                const rewardItem = items.find(it => it.id === barter.rewardItems[0].item.id);
                const trader = traders.find(tr => tr.id === barter.trader.id);
                const bitemname = `[${rewardItem.name}](${rewardItem.link}) (${trader.name} LL${barter.level})`;

                if (bitemname.length + 2 + otheritems.length > 2048) {
                    ending.setFooter({text: `${matchedBarters.length-i} ${t('additional results not shown.')}`,});
                    break;
                }
                otheritems += bitemname + "\n";
            }
            ending.setDescription(otheritems);

            embeds.push(ending);
        }

        return interaction.editReply({ embeds: embeds });
    },
    examples: '/$t(barter) slick'
};

export default defaultFunction;
