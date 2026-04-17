const { metro: { findByProps }, patcher, commands, storage } = window.vendetta;
const MessageStore = findByProps("getMessages", "getMessage");
const FluxDispatcher = findByProps("dispatch", "subscribe");
const UserStore = findByProps("getCurrentUser", "getUser");

const generateId = () => ((Date.now() - 14200704e5) * 4194304).toString();

export default {
    onLoad: () => {
        storage.fakeMessages ??= {};
        patcher.after("getMessages", MessageStore, ([channelId], result) => {
            const fakes = storage.fakeMessages[channelId] || [];
            if (fakes.length === 0) return result;
            const messages = [...(result?.messages || [])];
            fakes.forEach(fake => {
                if (!messages.find(m => m.id === fake.id)) messages.push(fake);
            });
            messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            return { ...result, messages };
        });

        commands.registerCommand({
            name: "dm",
            displayName: "dm",
            description: "Create a fake local message",
            displayDescription: "Create a fake local message",
            options: [
                { name: "user", displayName: "user", description: "User to impersonate", type: 6, required: true },
                { name: "message", displayName: "message", description: "Content", type: 3, required: true }
            ],
            execute: (args, ctx) => {
                const user = UserStore.getUser(args[0].value);
                if (!user) return { content: "Error: User not found." };
                const fakeMsg = {
                    id: generateId(),
                    type: 0,
                    content: args[1].value,
                    channel_id: ctx.channel.id,
                    author: { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar, bot: user.bot },
                    timestamp: new Date().toISOString(),
                    state: "SENT",
                };
                storage.fakeMessages[ctx.channel.id] ??= [];
                storage.fakeMessages[ctx.channel.id].push(fakeMsg);
                FluxDispatcher.dispatch({ type: "MESSAGE_CREATE", channelId: ctx.channel.id, message: fakeMsg });
            }
        });

        commands.registerCommand({
          name: "cleardms",
          displayName: "cleardms",
          description: "Clear fakes in this channel",
          displayDescription: "Clear fakes in this channel",
          execute: (args, ctx) => {
            delete storage.fakeMessages[ctx.channel.id];
            return { content: "Cleared. Switch channels to refresh." };
          }
        });
    },
    onUnload: () => patcher.unpatchAll()
};
