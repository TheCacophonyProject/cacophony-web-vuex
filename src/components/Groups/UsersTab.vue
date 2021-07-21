<template>
  <div class="container" v-if="!loading">
    <h2>
      Users
      <help>Only administrators can add new users</help>
    </h2>
    <div class="description-and-button-wrapper">
      <p>
        Users can view recordings for the devices associated with this group.
      </p>
      <group-user-add
        v-if="isGroupAdmin"
        :group-name="groupName"
        @user-added-to-group="$emit('user-added')"
      />
      <b-button
        v-if="isGroupAdmin"
        v-b-modal.group-user-add
        variant="primary"
        v-b-tooltip.hover
        title="Add user to group"
        class="add-button"
        data-cy="add_button"
      >
        <font-awesome-icon icon="user-plus" size="xs" />
        <span>Add user</span>
      </b-button>
    </div>

    <div v-if="!groupHasUsers">
      <b-card class="no-content-placeholder">
        <p>This group has no users associated with it.</p>
      </b-card>
    </div>
    <div v-else>
      <b-modal
        id="group-user-remove-self"
        title="Remove yourself from group"
        @ok="removeGroupUser(currentUser.username)"
        ok-title="Remove"
        ok-variant="danger"
        v-model="showUserRemoveSelfModal"
      >
        <p>
          Are you sure you want to remove yourself from this group? You will no
          longer be able to view recordings from the devices in this group and
          you will not be able to add yourself back to the group.
        </p>
      </b-modal>
      <b-table
        :items="users"
        :fields="[
          {
            key: 'userName',
            label: 'Username',
            sortable: true,
          },
          {
            key: 'admin',
            label: 'Administrator',
          },
          {
            key: 'controls',
            label: '',
            class: 'device-actions-cell',
          },
        ]"
        sort-by="username"
        striped
        hover
        outlined
        responsive
        data-cy="users-table"
      >
        <template v-slot:cell(admin)="data">
          {{ data.item.isGroupAdmin ? "Yes" : "No" }}
        </template>

        <template v-slot:cell(controls)="data">
          <b-button
            v-if="isGroupAdmin"
            :disabled="isRemovingUser"
            v-b-tooltip.hover
            title="Remove user from group"
            class="trash-button"
            variant="light"
            @click="removeGroupUserCheckIfSelf(data.item.userName)"
          >
            <font-awesome-icon icon="trash" size="1x" />
          </b-button>
        </template>
      </b-table>
    </div>
  </div>
</template>

<script lang="ts">
import GroupUserAdd from "./GroupUserAdd.vue";
import Help from "@/components/Help.vue";
import api from "@/api";
import { mapState } from "vuex";

// TODO(jon): Add device users - users who can't see the group, but who can see a particular device in the group.
//  Then we need a way for those users to see their device.

export default {
  name: "UsersTab",
  props: {
    isGroupAdmin: { type: Boolean, default: false },
    users: { type: Array, required: true },
    loading: { type: Boolean, default: false },
    groupName: { type: String, required: true },
  },
  components: {
    GroupUserAdd,
    Help,
  },
  data() {
    return {
      isRemovingUser: false,
      showUserRemoveSelfModal: false,
    };
  },
  computed: {
    ...mapState({
      currentUser: (state) => (state as any).User.userData,
    }),
    groupHasUsers() {
      return this.users.length !== 0;
    },
  },
  methods: {
    async removeGroupUser(userName: string) {
      this.isRemovingUser = true;
      {
        await api.groups.removeGroupUser(this.groupName, userName);
        // Mutate our local users object, we don't need to fetch it again.
        this.$emit("user-removed", userName);
      }
      this.isRemovingUser = false;
    },
    async removeGroupUserCheckIfSelf(userName: string) {
      if (
        !this.currentUser.isSuperUser &&
        userName === this.currentUser.username
      ) {
        this.showUserRemoveSelfModal = true;
      } else {
        await this.removeGroupUser(userName);
      }
    },
  },
};
</script>

<style scoped></style>
