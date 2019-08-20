// Update components to match the user's login status
solid.auth.trackSession(async function(session) {
    let loggedIn = !!session;

    const $userUrl = $('#user');
    if (loggedIn) {
        $('#loggedIn').toggle(true);
        $userUrl.text(session.webId);
        $userUrl.attr('href', session.webId);

        LoggedUser.webId = session.webId;

        // Initialize app data
        await initApp(session.webId);

        // Load patient's health records
        await loadRecords();

        // Use the user's WebID as default profile
        const $profile = $('#profile');
        if (!$profile.val()) {
            $profile.val(session.webId);
        }
    }
});

function loadRecords() {
    const url = LoggedUser.storage + 'health/records/';
    _loadRecords(url);
}

$('#records').on('click', '.media', function() {
    let $aclUsers = $('#acl-users');
    $aclUsers.empty();

    let uri = this.id;
    let record = recordsData[uri];
    $('#record-uri').val(uri);
    $('#edit-title').text(record.title);
    $('#edit-author').text(record.doctor);
    $('#edit-content').val(record.content);

    solidClient.getPermissions(uri)
        .then(function (permissionSet) {
            permissionSet.forEach(function (auth) {
                if (auth.virtual)
                    return;

                // TODO fix this
                // Hardcoded just to fix groups by showing
                // Note: auth.isGroup() not working for groups!
                if (auth.agent.indexOf("groups.ttl") > -1)
                    return;

                // Prevent user from changing his own access rights, to prevent him from locking his own data
                if (auth.webId() === LoggedUser.webId)
                    return;

                if (auth.isAgent()) {
                    console.log('agent webId: ' + auth.agent)
                } else if (auth.isPublic()) {
                    // this permission is for everyone (acl:agentClass foaf:Agent)
                    return;
                } else if (auth.isGroup()) {
                    console.log('GROUP agentClass webId: ' + auth.group)
                    return;
                }

                let read, write, append = '';
                if (auth.allowsRead()) read = 'checked';
                if (auth.allowsWrite()) write = 'checked';
                if (auth.allowsAppend()) append = 'checked';

                $aclUsers.append(
                    `<li class="list-group-item">
                        <span class="acl-webId">${auth.webId()}</span>
                        <span class="float-right">
                            <label>R</label>
                            <input type="checkbox" name="acl-read" ${read}>
                            <label>W</label>
                            <input type="checkbox" name="acl-write" ${write}>
                            <label>A</label>
                            <input type="checkbox" name="acl-append" ${append}>
                        </span>
                    </li>`
                );
            });

            $('#edit-record-modal').modal('show');
        });
});

$('#acl-add').click(function() {
    let $aclUsers = $('#acl-users');
    let $newUser = $('#acl-new-user');

    $aclUsers.append(
        `<li class="list-group-item">
            <span class="acl-webId">${$newUser.val()}</span>
            <span class="float-right">
                <label>R</label>
                <input type="checkbox" name="acl-read" checked>
                <label>W</label>
                <input type="checkbox" name="acl-write">
                <label>A</label>
                <input type="checkbox" name="acl-append">
            </span>
        </li>`
    );
    $newUser.val('');
    $(this).blur();
});

const ACL_RIGHTS = {
    r: 'acl:Read',
    w: 'acl:Write',
    a: 'acl:Append',
    rw: 'acl:Read, acl:Write',
    ra: 'acl:Read, acl:Append',
    wa: 'acl:Write, acl:Append',
    rwa: 'acl:Read, acl:Write, acl:Append',
};

$('#edit-record').click(async function() {
    let recordUri = $('#record-uri').val();
    const recordAclUrl = recordUri + '.acl';

    let content =
        `@prefix  acl:  <http://www.w3.org/ns/auth/acl#>.

# The owner has all of the access modes allowed
<#owner>
    a acl:Authorization;
    acl:agent <${LoggedUser.webId}>;
    acl:accessTo <${recordUri}>;
    acl:mode
        acl:Read, acl:Write, acl:Control.

# Group authorization, giving Read/Write access to members of the Doctor group
<#authorization>
    a               acl:Authorization;
    acl:accessTo    <${recordUri}>;
    acl:mode        acl:Read,
                    acl:Write;
    acl:agentGroup  <https://example.com:8443/groups.ttl#Doctor>.

`;

    let count = 1;

    for (let li of $('#acl-users li')) {
        let $li = $(li);
        let uri = $li.find('.acl-webId').text();

        let read = $li.find('input[name="acl-read"]').prop('checked');
        let write = $li.find('input[name="acl-write"]').prop('checked');
        let append = $li.find('input[name="acl-append"]').prop('checked');
        if (!read && !write && !append)
            continue;

        let rights = '';
        if (read) rights += 'r';
        if (write) rights += 'w';
        if (append) rights += 'a';

        content +=
            `<#authorization${count}>
    a acl:Authorization;
    acl:agent <${uri}>;
    acl:accessTo <${recordUri}>;
    acl:mode
        ${ACL_RIGHTS[rights]}.
        
`;

        count++;

    }
    await solidClient.web.put(recordAclUrl, content).then(function (meta) {
        $('#edit-record-modal').modal('hide');
        return meta.url;
    }).catch(function (err) {
        alert("Nekaj je šlo narobe. " + err);
        console.log(err);
    });


});