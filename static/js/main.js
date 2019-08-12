const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');


// Update components to match the user's login status
solid.auth.trackSession(session => {
    let loggedIn = !!session;
    $('#login').toggle(!loggedIn);
    $('#logout').toggle(loggedIn);
    const $userUrl = $('#user');
    if (loggedIn) {
        $('#loggedIn').toggle(true);
        $userUrl.text(session.webId);
        $userUrl.attr('href', session.webId);

        // Use the user's WebID as default profile
        const $profile = $('#profile');
        if (!$profile.val()) {
            $profile.val(session.webId);
        }
    } else {
        $('#loggedIn').toggle(false);
    }
});


$('#view').click(async function loadProfile() {
    // Set up a local data store and associated data fetcher
    const store = $rdf.graph();
    const fetcher = new $rdf.Fetcher(store);

    // Load the person's data into the store
    const person = $('#profile').val();
    await fetcher.load(person);

    // Display their details
    const fullName = store.any($rdf.sym(person), FOAF('name'));
    $('#fullName').text(fullName && fullName.value);

    // Display their friends
    const friends = store.each($rdf.sym(person), FOAF('knows'));
    $('#friends').empty();
    friends.forEach(async (friend) => {
        await fetcher.load(friend);
        const fullName = store.any(friend, FOAF('name'));
        $('#friends').append(
            $('<li>').append(
                $('<a>').text(fullName && fullName.value || friend.value)
                    .click(() => $('#profile').val(friend.value))
                    .click(loadProfile)));
    });
});
