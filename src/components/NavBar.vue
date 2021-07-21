<template>
  <div class="nav-bar">
    <div v-if="isViewingAsOtherUser()" class="super-user-bar">
      <font-awesome-icon icon="glasses" class="icon" />
      <span
        ><strong>{{ superUserName() }}</strong> viewing as
        <strong>{{ userName }}</strong></span
      >
      <a @click="revertViewingUser">
        <font-awesome-icon icon="reply" class="icon" />
        Revert</a
      >
    </div>
    <div
      v-if="config.environment !== 'PRODUCTION' && showRevisionInfo"
      class="git-revision-bar"
    >
      <a :href="revisionLink" target="_blank" :title="commitMessage">{{
        revisionInfo
      }}</a>
      <a class="close-button" @click="showRevisionInfo = false">dismiss</a>
    </div>
    <b-navbar toggleable="lg">
      <b-navbar-brand>
        <router-link class="navbar-brand" to="/" alt="home" />
      </b-navbar-brand>

      <b-navbar-toggle target="navbarToggler" />

      <b-collapse id="navbarToggler" is-nav>
        <b-navbar-nav>
          <b-nav-item to="/visits">Visits</b-nav-item>
          <b-nav-item to="/analysis">Analysis</b-nav-item>
          <b-nav-item to="/recordings">Recordings</b-nav-item>
          <b-nav-item to="/tagging">Power Tagger</b-nav-item>
        </b-navbar-nav>

        <b-navbar-nav class="ml-auto">
          <b-nav-item to="/groups">
            <font-awesome-icon icon="users" class="icon" />
            Groups
          </b-nav-item>
          <b-nav-item-dropdown class="profile" right>
            <template slot="button-content">
              <font-awesome-icon
                v-if="hasGlobalReadPermissions"
                :icon="['fas', 'user-secret']"
                class="icon"
              />
              <font-awesome-icon
                v-else
                :icon="['far', 'user-circle']"
                class="icon"
              />&nbsp;{{ userName }}
              <span v-if="hasGlobalReadPermissions && !isViewingAsOtherUser()">
                {{ isViewingAsSuperUser ? "(super admin)" : "(user)" }}
              </span>
            </template>

            <b-dropdown-group header="View as" v-if="hasGlobalReadPermissions">
              <b-dropdown-item
                :active="isViewingAsSuperUser"
                @click="viewAsSuperUser"
              >
                <font-awesome-icon
                  :icon="['fas', 'user-secret']"
                  class="icon"
                />&nbsp;Super admin
              </b-dropdown-item>

              <b-dropdown-item
                :active="isViewingAsRegularUser"
                @click="viewAsRegularUser"
              >
                <font-awesome-icon
                  :icon="['far', 'user-circle']"
                  class="icon"
                />&nbsp;User
              </b-dropdown-item>

              <b-dropdown-item
                @click="showChangeUserViewDialog = true"
                :active="isViewingAsOtherUser()"
              >
                <font-awesome-icon icon="glasses" class="icon" />
                &nbsp;Another user
              </b-dropdown-item>
            </b-dropdown-group>
            <b-dropdown-divider></b-dropdown-divider>
            <b-dropdown-item @click="logout">
              <font-awesome-icon icon="power-off" class="icon" />&nbsp;Logout
            </b-dropdown-item>
          </b-nav-item-dropdown>
        </b-navbar-nav>
      </b-collapse>
    </b-navbar>
    <b-modal
      v-model="showChangeUserViewDialog"
      @ok="changeViewingUser"
      title="View as another user"
    >
      <b-form-group>
        <label>Select user</label>
        <multiselect
          v-model="selectedUser"
          :options="users"
          :placeholder="usersListLabel"
          :disabled="users.length === 0"
          track-by="id"
          label="name"
        />
      </b-form-group>
    </b-modal>
  </div>
</template>

<script lang="ts">
import User from "../api/User.api";
import { shouldViewAsSuperUser } from "@/utils";
import config from "@/config";

export const superUserCreds = (): any | boolean => {
  let superUserCreds = localStorage.getItem("superUserCreds");
  if (superUserCreds) {
    try {
      superUserCreds = JSON.parse(superUserCreds);
      return superUserCreds;
    } catch (e) {
      return false;
    }
  }
  return false;
};
export const isViewingAsOtherUser = () => {
  const creds = superUserCreds();
  return !!(
    creds &&
    creds.token &&
    creds.token !== localStorage.getItem("JWT")
  );
};

export default {
  name: "Navbar",
  data() {
    return {
      internalShowChangeUserViewDialog: false,
      users: [],
      usersListLabel: "loading users",
      showRevisionInfo: true,
      viewAs: "",
      selectedUser: {
        name: "",
        id: "",
      },
      config,
    };
  },
  computed: {
    revisionInfo() {
      let version = this.config.revisionInfo.version;
      if (this.config.revisionInfo.travis) {
        version =
          this.config.revisionInfo.travis.branch ||
          this.config.revisionInfo.travis.tag;
      }
      const commitTime = new Date(Date.parse(this.config.revisionInfo.time));
      return `${
        this.config.revisionInfo.branch
      } :: ${version}, ${commitTime.toLocaleDateString()} ${commitTime.toLocaleTimeString()}`;
    },
    revisionLink() {
      const info = this.config.revisionInfo;
      let slug;
      if (info.travis && info.travis.tag) {
        slug = `releases/tag/${info.travis.tag}`;
      } else {
        slug = `commit/${info.commit}`;
      }
      return `https://github.com/TheCacophonyProject/cacophony-browse/${slug}`;
    },
    commitMessage() {
      if (this.config.revisionInfo.travis) {
        return this.config.revisionInfo.travis.commitMessage;
      }
      return false;
    },
    userName() {
      return this.$store.state.User.userData.username;
    },
    globalPermission() {
      return this.$store.state.User.userData.globalPermission;
    },
    isSuperUser() {
      return this.globalPermission === "write";
    },
    hasGlobalReadPermissions() {
      return (
        this.globalPermission === "write" || this.globalPermission === "read"
      );
    },
    showChangeUserViewDialog: {
      async set(val) {
        this.internalShowChangeUserViewDialog = val;
        if (this.users.length === 0) {
          await this.initUsersList();
          this.usersListLabel = "select a user";
        }
      },
      get() {
        return this.internalShowChangeUserViewDialog;
      },
    },
    isViewingAsSuperUser() {
      return this.viewAs === "super";
    },
    isViewingAsRegularUser() {
      return this.viewAs === "regular";
    },
  },
  mounted() {
    this.viewAs = shouldViewAsSuperUser() ? "super" : "regular";
  },
  methods: {
    async initUsersList() {
      if (this.hasGlobalReadPermissions) {
        const usersList = await User.list();
        this.users = usersList.result.usersList
          .map(({ username, id }) => ({
            name: username,
            id,
          }))
          .filter(({ name }) => name !== this.superUserName());
      }
    },
    superUserName() {
      const creds = superUserCreds();
      return creds && creds.username;
    },
    logout() {
      this.$store.dispatch("User/LOGOUT");
      this.$router.go("home");
    },
    async changeViewingUser() {
      if (this.selectedUser) {
        // Log in as user:
        const otherUser = await User.loginOther(this.selectedUser.name);
        this.$store.dispatch("User/LOGIN_OTHER", otherUser.result);
        window.location.reload();
      }
    },
    revertViewingUser() {
      const superUser = superUserCreds();
      if (superUser) {
        this.$store.dispatch("User/LOGIN_OTHER", {
          userData: { ...superUser },
          token: superUser.token,
        });
        this.selectedUser = null;
        window.location.reload();
      }
    },
    viewAsSuperUser() {
      localStorage.setItem("view-as", "super");
      this.viewAs = "super";
      // TODO: Would be nicer to not require a reload here, but maybe doesn't matter since this is really just an
      //  admin/debug feature
      window.location.reload();
    },
    viewAsRegularUser() {
      localStorage.setItem("view-as", "regular");
      this.viewAs = "regular";
      // TODO: Would be nicer to not require a reload here, but maybe doesn't matter since this is really just an
      //  admin/debug feature
      window.location.reload();
    },
    superUserCreds() {
      return superUserCreds();
    },
    isViewingAsOtherUser() {
      return isViewingAsOtherUser();
    },
  },
};
</script>

<style scoped lang="scss">
.navbar {
  border-bottom: solid rgb(222, 226, 230) 1px;
  padding-top: 0;
  padding-bottom: 0;
}

.navbar-brand {
  width: 70%;
}

.navbar-brand img {
  width: 100%;
}
.active {
  background-color: #eeeeee;
  color: #555;
  border-radius: 2px;
}

.icon {
  width: 1.6em;
  text-align: center;
}

.super-user-bar,
.git-revision-bar {
  background: purple;
  color: white;
  padding: 5px 10px;
  height: 34px;
  cursor: default;
  user-select: none;
  a,
  a:hover {
    cursor: pointer;
    color: inherit;
    text-decoration: underline;
  }
}
.super-user-bar {
  a,
  a:hover {
    float: right;
  }
}
.git-revision-bar {
  background: #2b333f;
  font-size: 13px;
  a {
    text-decoration: none;
  }
  .close-button {
    float: right;
    background: darken(#2b333f, 10%);
    min-height: 22px;
    line-height: 20px;
    text-align: center;
    vertical-align: middle;
    text-decoration: none;
    border-radius: 3px;
    cursor: pointer;
    padding: 0 5px;
    font-size: 10px;
    user-select: none;
    &:hover {
      text-decoration: none;
      background: lighten(#2b333f, 10%);
    }
  }
}

@media only screen and (min-width: 576px) {
  .navbar-brand {
    width: auto;
  }

  .navbar-brand img {
    width: auto;
  }

  .profile {
    border-left: solid rgb(222, 226, 230) 1px;
  }
}
</style>
<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>
