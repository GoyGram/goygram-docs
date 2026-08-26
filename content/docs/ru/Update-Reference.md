---
title: "Update Reference"
---

# Update Reference

This page lists the update constructors in the active Telegram TL schema used by GoyGram. The current cache contains **172 update constructors**: **165** returning `Update` and **7** returning an `Updates` envelope.

GoyGram does not allocate a Python class for every constructor. Structured updates are decoded by the dynamic schema and delivered to `on_update` as `UpdateObj`. Message, edit, callback, poll, and member events also pass through `on_update` before their specialized handler.


```python
@app.on_update(filt=filters.update_type("updateMessageReactions"))
async def event(update):
    print(update.update_type)
    print(update.raw)
```


## Constructors

### Returning `Update`

| Constructor | CID |
|---|---|
| `updateNewMessage` | `0x1f2b0afd` |
| `updateMessageID` | `0x4e90bfd6` |
| `updateDeleteMessages` | `0xa20db0e5` |
| `updateUserTyping` | `0x2a17bf5c` |
| `updateChatUserTyping` | `0x83487af0` |
| `updateChatParticipants` | `0x7761198` |
| `updateUserStatus` | `0xe5bdf8de` |
| `updateUserName` | `0xa7848924` |
| `updateNewAuthorization` | `0x8951abef` |
| `updateNewEncryptedMessage` | `0x12bcbd9a` |
| `updateEncryptedChatTyping` | `0x1710f156` |
| `updateEncryption` | `0xb4a2e88d` |
| `updateEncryptedMessagesRead` | `0x38fe25b7` |
| `updateChatParticipantAdd` | `0x3dda5451` |
| `updateChatParticipantDelete` | `0xe32f3d77` |
| `updateDcOptions` | `0x8e5e9873` |
| `updateNotifySettings` | `0xbec268ef` |
| `updateServiceNotification` | `0xebe46819` |
| `updatePrivacy` | `0xee3b272a` |
| `updateUserPhone` | `0x5492a13` |
| `updateReadHistoryInbox` | `0x9e84bc99` |
| `updateReadHistoryOutbox` | `0x2f2f21bf` |
| `updateWebPage` | `0x7f891213` |
| `updateReadMessagesContents` | `0xf8227181` |
| `updateChannelTooLong` | `0x108d941f` |
| `updateChannel` | `0x635b4c09` |
| `updateNewChannelMessage` | `0x62ba04d9` |
| `updateReadChannelInbox` | `0x922e6e10` |
| `updateDeleteChannelMessages` | `0xc32d5b12` |
| `updateChannelMessageViews` | `0xf226ac08` |
| `updateChatParticipantAdmin` | `0xd7ca61a2` |
| `updateNewStickerSet` | `0x688a30aa` |
| `updateStickerSetsOrder` | `0xbb2d201` |
| `updateStickerSets` | `0x31c24808` |
| `updateSavedGifs` | `0x9375341e` |
| `updateBotInlineQuery` | `0x496f379c` |
| `updateBotInlineSend` | `0x12f12a07` |
| `updateEditChannelMessage` | `0x1b3f4df7` |
| `updateBotCallbackQuery` | `0xb9cfc48d` |
| `updateEditMessage` | `0xe40370a3` |
| `updateInlineBotCallbackQuery` | `0x691e9052` |
| `updateReadChannelOutbox` | `0xb75f99a9` |
| `updateDraftMessage` | `0xedfc111e` |
| `updateReadFeaturedStickers` | `0x571d2742` |
| `updateRecentStickers` | `0x9a422c20` |
| `updateConfig` | `0xa229dd06` |
| `updatePtsChanged` | `0x3354678f` |
| `updateChannelWebPage` | `0x2f2ba99f` |
| `updateDialogPinned` | `0x6e6fe51c` |
| `updatePinnedDialogs` | `0xfa0f3ca2` |
| `updateBotWebhookJSON` | `0x8317c0c3` |
| `updateBotWebhookJSONQuery` | `0x9b9240a6` |
| `updateBotShippingQuery` | `0xb5aefd7d` |
| `updateBotPrecheckoutQuery` | `0x8caa9a96` |
| `updatePhoneCall` | `0xab0f6b1e` |
| `updateLangPackTooLong` | `0x46560264` |
| `updateLangPack` | `0x56022f4d` |
| `updateFavedStickers` | `0xe511996d` |
| `updateChannelReadMessagesContents` | `0x25f324f7` |
| `updateContactsReset` | `0x7084a7be` |
| `updateChannelAvailableMessages` | `0xb23fc698` |
| `updateDialogUnreadMark` | `0xb658f23e` |
| `updateMessagePoll` | `0xd64c522b` |
| `updateChatDefaultBannedRights` | `0x54c01850` |
| `updateFolderPeers` | `0x19360dc0` |
| `updatePeerSettings` | `0x6a7e7366` |
| `updatePeerLocated` | `0xb4afcfb0` |
| `updateNewScheduledMessage` | `0x39a51dfb` |
| `updateDeleteScheduledMessages` | `0xf2a71983` |
| `updateTheme` | `0x8216fba3` |
| `updateGeoLiveViewed` | `0x871fb939` |
| `updateLoginToken` | `0x564fe691` |
| `updateMessagePollVote` | `0x7699f014` |
| `updateDialogFilter` | `0x26ffde7d` |
| `updateDialogFilterOrder` | `0xa5d72105` |
| `updateDialogFilters` | `0x3504914f` |
| `updatePhoneCallSignalingData` | `0x2661bf09` |
| `updateChannelMessageForwards` | `0xd29a27f4` |
| `updateReadChannelDiscussionInbox` | `0xd6b19546` |
| `updateReadChannelDiscussionOutbox` | `0x695c9e7c` |
| `updatePeerBlocked` | `0xebe07752` |
| `updateChannelUserTyping` | `0x8c88c923` |
| `updatePinnedMessages` | `0xed85eab5` |
| `updatePinnedChannelMessages` | `0x5bb98608` |
| `updateChat` | `0xf89a6a4e` |
| `updateGroupCallParticipants` | `0xf2ebdb4e` |
| `updateGroupCall` | `0x9d2216e0` |
| `updatePeerHistoryTTL` | `0xbb9bb9a5` |
| `updateChatParticipant` | `0xd087663a` |
| `updateChannelParticipant` | `0x985d3abb` |
| `updateBotStopped` | `0xc4870a49` |
| `updateGroupCallConnection` | `0xb783982` |
| `updateBotCommands` | `0x4d712f2e` |
| `updatePendingJoinRequests` | `0x7063c3db` |
| `updateBotChatInviteRequester` | `0x7cb34d79` |
| `updateMessageReactions` | `0x1e297bfa` |
| `updateAttachMenuBots` | `0x17b7a20b` |
| `updateWebViewResultSent` | `0x1592b79d` |
| `updateBotMenuButton` | `0x14b85813` |
| `updateSavedRingtones` | `0x74d8be99` |
| `updateTranscribedAudio` | `0x84cd5a` |
| `updateReadFeaturedEmojiStickers` | `0xfb4c496c` |
| `updateUserEmojiStatus` | `0x28373599` |
| `updateRecentEmojiStatuses` | `0x30f443db` |
| `updateRecentReactions` | `0x6f7863f4` |
| `updateMoveStickerSetToTop` | `0x86fccf85` |
| `updateMessageExtendedMedia` | `0xd5a41724` |
| `updateUser` | `0x20529438` |
| `updateAutoSaveSettings` | `0xec05b097` |
| `updateStory` | `0x75b3b798` |
| `updateReadStories` | `0xf74e932b` |
| `updateStoryID` | `0x1bf335b9` |
| `updateStoriesStealthMode` | `0x2c084dc1` |
| `updateSentStoryReaction` | `0x7d627683` |
| `updateBotChatBoost` | `0x904dd49c` |
| `updateChannelViewForumAsMessages` | `0x7b68920` |
| `updatePeerWallpaper` | `0xae3f101d` |
| `updateBotMessageReaction` | `0xac21d3ce` |
| `updateBotMessageReactions` | `0x9cb7759` |
| `updateSavedDialogPinned` | `0xaeaf9e74` |
| `updatePinnedSavedDialogs` | `0x686c85a6` |
| `updateSavedReactionTags` | `0x39c67432` |
| `updateSmsJob` | `0xf16269d4` |
| `updateQuickReplies` | `0xf9470ab2` |
| `updateNewQuickReply` | `0xf53da717` |
| `updateDeleteQuickReply` | `0x53e6f1ec` |
| `updateQuickReplyMessage` | `0x3e050d0f` |
| `updateDeleteQuickReplyMessages` | `0x566fe7cd` |
| `updateBotBusinessConnect` | `0x8ae5c97a` |
| `updateBotNewBusinessMessage` | `0x9ddb347c` |
| `updateBotEditBusinessMessage` | `0x7df587c` |
| `updateBotDeleteBusinessMessage` | `0xa02a982e` |
| `updateNewStoryReaction` | `0x1824e40b` |
| `updateStarsBalance` | `0x4e80a379` |
| `updateBusinessBotCallbackQuery` | `0x1ea2fda7` |
| `updateStarsRevenueStatus` | `0xa584b019` |
| `updateBotPurchasedPaidMedia` | `0x283bd312` |
| `updatePaidReactionPrivacy` | `0x8b725fce` |
| `updateSentPhoneCode` | `0x504aa18f` |
| `updateGroupCallChainBlocks` | `0xa477288f` |
| `updateReadMonoForumInbox` | `0x77b0e372` |
| `updateReadMonoForumOutbox` | `0xa4a79376` |
| `updateMonoForumNoPaidException` | `0x9f812b08` |
| `updateGroupCallMessage` | `0xd8326f0d` |
| `updateGroupCallEncryptedMessage` | `0xc957a766` |
| `updatePinnedForumTopic` | `0x683b2c52` |
| `updatePinnedForumTopics` | `0xdef143d0` |
| `updateDeleteGroupCallMessages` | `0x3e85e92c` |
| `updateStarGiftAuctionState` | `0x48e246c2` |
| `updateStarGiftAuctionUserState` | `0xdc58f31e` |
| `updateEmojiGameInfo` | `0xfb9c547a` |
| `updateStarGiftCraftFail` | `0xac072444` |
| `updateChatParticipantRank` | `0xbd8367b9` |
| `updateManagedBot` | `0x4880ed9a` |
| `updateBotGuestChatQuery` | `0xcdd4093d` |
| `updateAiComposeTones` | `0x8c0f91fb` |
| `updateJoinChatWebViewDecision` | `0xbdac7e70` |
| `updateNewBotConnection` | `0xb22083a6` |
| `updateWebBrowserSettings` | `0xc39a2ade` |
| `updateWebBrowserException` | `0x140502d1` |
| `updateNewEphemeralMessage` | `0x20bcbba1` |
| `updateDeleteEphemeralMessages` | `0x56dbfcf8` |
| `updateEditEphemeralMessage` | `0x4bbb8f01` |
| `updateEphemeralBotCallbackQuery` | `0x7c1079d6` |
| `updateBotStarsSubscription` | `0x6c0d8e23` |

### Returning `Updates`

| Constructor | CID |
|---|---|
| `updatesTooLong` | `0xe317af7e` |
| `updateShortMessage` | `0x313bc7f8` |
| `updateShortChatMessage` | `0x4d6deea5` |
| `updateShort` | `0x78d4dec1` |
| `updatesCombined` | `0x725b04c3` |
| `updates` | `0x74ae4240` |
| `updateShortSentMessage` | `0x9015e101` |