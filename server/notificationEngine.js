/**
 * /server/notificationEngine.js
 * Logic: Sends notifications to all registered devices for a user.
 */
const webpush = require('web-push');

webpush.setVapidDetails(
    'mailto:crypchain@outlook.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);


async function notifyTrade(supabase, userId, trade) {
    const { data: subs, error } = await supabase
        .from('user_subscriptions')
        .select('subscription_data')
        .eq('user_uuid', userId);

    if (error || !subs || subs.length === 0) return;

    // Formatting the write-up like history
    const isWin = trade.result === 'green';
    const statusEmoji = isWin ? '✅' : '❌';
    const profitSign = isWin ? '+' : '';

    const payload = JSON.stringify({
        title: `${statusEmoji} Trade ${isWin ? 'PROFIT' : 'LOSS'}`,
        body: `Asset: ${trade.symbol}\nAmount: $${trade.amount.toFixed(2)}\nProfit: ${profitSign}$${trade.profit.toFixed(4)}`,
        image: isWin ? 'https://xpmqqvrloficsbknyiuc.supabase.co/storage/v1/object/public/logo/logo.png' : 'https://xpmqqvrloficsbknyiuc.supabase.co/storage/v1/object/public/logo/logo.png',
        url: `/chart/index.html?user_id=${userId}`
    });

    subs.forEach(sub => {
        const pushConfig = JSON.parse(sub.subscription_data);
        webpush.sendNotification(pushConfig, payload).catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
                supabase.from('user_subscriptions').delete().eq('subscription_data', sub.subscription_data).then();
            }
        });
    });
}

module.exports = { notifyTrade };