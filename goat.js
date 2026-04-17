const {
  metadata: { name: PluginName },
  storage,
  patcher,
  commands,
  modules: {
    common: { Dispatcher, FluxDispatcher, Messages, Channels, Users, SelectedChannel },
    filters: { byProps }
  }
} = window.vendetta; // btloader typically uses the vendetta/aliucord bridge

// Helper to generate a fake Snowflake ID
const generateId = () => ((Date.now() - 14200704e5) * 4194304).toString();

const HiddenDM = {
  onLoad() {
    // Initialize storage for fake messages
    storage.fakeMessages ??= {};

    // 1. THE PATCH: Injects fake messages into the UI message list
    const MessageStore = byProps("getMessages", "getMessage");
    patcher.after("getMessages", MessageStore, ([channelId], result) => {
      const fakes = storage.fakeMessages[channelId] || [];
      if (fakes.length === 0) return result;

      // Merge real messages with our fakes
      const messages = [...(result?.messages || [])];
      fakes.forEach(fake => {
        if (!messages.find(m => m.id === fake.id)) {
          messages.push(fake);
        }
      });

      // Sort by timestamp so they appear in order
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return { ...result, messages };
    });

    // 2. THE DM COMMAND: /dm <user> <message>
    commands.registerCommand({
      name: "dm",
      displayName: "dm",
      description: "Create a fake message from any user (Local Only)",
      displayDescription: "Create a fake message from any user (Local Only)",
      options: [
        {
          name: "user",
          displayName: "user",
          description: "The user to impersonate",
          type: 6, // User type
          required: true,
        },
        {
          name: "message",
          displayName: "message",
          description: "Message content",
          type: 3, // String type
          required: true,
        }
      ],
      execute: (args, ctx) => {
        const userId = args[0].value;
        const content = args[1].value;
        const channelId = ctx.channel.id;
        const user = Users.getUser(userId);

        if (!user) {
          return { content: "Error: User not found in local cache." };
        }

        const fakeMsg = {
          id: generateId(),
          type: 0,
          content: content,
          channel_id: channelId,
          author: {
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar,
            bot: user.bot,
          },
          timestamp: new Date().toISOString(),
          state: "SENT",
          fake: true // Flag to identify local fakes
        };

        // Save to storage
        storage.fakeMessages[channelId] ??= [];
        storage.fakeMessages[channelId].push(fakeMsg);

        // Force UI update via Dispatcher
        FluxDispatcher.dispatch({
          type: "MESSAGE_CREATE",
          channelId: channelId,
          message: fakeMsg,
          optimistic: false,
          sendMessageOptions: {},
          isPushNotification: false,
        });
      }
    });

    // 3. THE CLEAR COMMAND: /cleardms
    commands.registerCommand({
      name: "cleardms",
      displayName: "cleardms",
      description: "Clear all local fake messages in this channel",
      displayDescription: "Clear all local fake messages in this channel",
      execute: (args, ctx) => {
        const channelId = ctx.channel.id;
        delete storage.fakeMessages[channelId];
        return { content: "Fake messages cleared for this channel. (Restart or switch channels to refresh UI)" };
      }
    });
  },

  onUnload() {
    patcher.unpatchAll();
  }
};

export default HiddenDM;
