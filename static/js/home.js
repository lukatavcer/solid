// Update components to match the user's login status
solid.auth.trackSession(session => {
    let loggedIn = !!session;

    const $userUrl = $('#user');
    if (loggedIn) {
        $('#loggedIn').toggle(true);
        $userUrl.text(session.webId);
        $userUrl.attr('href', session.webId);

        LoggedUser.webId = session.webId;

        // Initialize app data
        initApp(session.webId);

        // Use the user's WebID as default profile
        const $profile = $('#profile');
        if (!$profile.val()) {
            $profile.val(session.webId);
        }
    }
});