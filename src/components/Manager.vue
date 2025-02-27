<template>
  <v-app>
    <v-navigation-drawer
      app
      permanent
      id="nav-drawer"
      class="sidebar"
      width="300"
    >
      <v-toolbar color="grey darken-4" dark flat dense>
        <v-spacer></v-spacer>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              class="select-folder-btn"
              icon
              v-on="on"
              @click="locateFolder"
            >
              <v-icon small>folder_special</v-icon>
            </v-btn>
          </template>
          <span>Manually select TeslaCam folder</span>
        </v-tooltip>

        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              class="refresh-btn"
              icon
              v-on="on"
              @click="getData(tab, true)"
            >
              <v-icon small>refresh</v-icon>
            </v-btn>
          </template>
          <span>Refresh list</span>
        </v-tooltip>

        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              class="open-folder-btn"
              icon
              v-on="on"
              @click="openFolder"
            >
              <v-icon small>folder_open</v-icon>
            </v-btn>
          </template>
          <span>Open {{ tabTypeFolderName }} folder</span>
        </v-tooltip>

        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              class="delete-all-btn"
              icon
              v-on="on"
              :disabled="isLoading"
              @click="confirmDeleteAll = true"
            >
              <v-icon small>delete_sweep</v-icon>
            </v-btn>
          </template>
          <span>Delete all videos in {{ tabTypeFolderName }} (except any tagged)</span>
        </v-tooltip>

        <v-dialog
          v-model="confirmDeleteAll"
          max-width="340"
        >
          <v-card>
            <v-card-title>Are you sure?</v-card-title>
            <v-card-text>Confirm that you want to delete all videos in the <span class="font-weight-medium">{{ tabType === 'recent' ? 'RecentClips' : 'SavedClips' }}</span> folder except for those that were tagged.</v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn color="primary" @click.prevent="onDeleteAll">Delete</v-btn>
              <v-btn @click="confirmDeleteAll = false">Cancel</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-toolbar>

      <v-tabs
        v-model="tab"
        @change="onTabChange"
      >
        <v-tab ripple>
          Recent
        </v-tab>
        <v-tab ripple>
          Saved / Sentry
        </v-tab>

        <!-- @todo Refactor this into a v-for -->
        <v-tab-item>
          <v-layout
            v-if="isLoading"
            justify-center
          >
            <v-progress-circular
              class="progress-loader"
              color="primary"
              indeterminate />
          </v-layout>
          <video-list
            v-else
            type="recent"
            :disable-item="deletingVideo"
            :videos="recentVideosData"
            @delete="onDelete">
          </video-list>
        </v-tab-item>

        <v-tab-item>
          <v-layout
            v-if="isLoading"
            justify-center
          >
            <v-progress-circular
              class="progress-loader"
              color="primary"
              indeterminate />
          </v-layout>
          <video-list
            v-else
            type="saved"
            :disable-item="deletingVideo"
            :videos="savedVideosData"
            @delete="onDelete">
          </video-list>
        </v-tab-item>
      </v-tabs>

      <template v-slot:append>
        <v-toolbar color="grey darken-4" dark flat>
          <disk-usage
            v-if="teslaCamDrive && Object.keys(diskUsageData).length > 0"
            :info="{ ...diskUsageData, mnt: teslaCamDrive }">
          </disk-usage>
        </v-toolbar>
      </template>
    </v-navigation-drawer>

    <v-main>
      <video-player
        @next="onPlayNext"
        @prev="onPlayPrev"
      />
    </v-main>

    <v-dialog
      v-model="isSettingUp"
      persistent
      width="400"
    >
      <v-card
        color="secondary"
        dark
      >
        <v-card-text>
          Initializing
          <v-progress-linear
            indeterminate
            color="white"
            class="mb-0"
          />
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- <v-dialog
      v-model="errors.binaries"
      max-width="340"
      persistent
    >
      <v-card>
        <v-card-title>There was an error</v-card-title>
        <v-card-text>Unable to download some required binaries for video handling. Check your internet connection and try again.</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="doSetup">Retry</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog> -->

    <v-dialog
      v-model="errors.drive"
      max-width="420"
      persistent
    >
      <v-card>
        <v-card-title>Can't locate USB drive</v-card-title>
        <v-card-text>Unable to detect a drive on your computer that contains the root <em>TeslaCam</em> directory</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="getData(tab, true)">Try again</v-btn>
          <v-btn @click="locateFolder">Manually Locate</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="errors.locateFolder"
      max-width="420"
    >
      <v-card>
        <v-card-title>Can't determine TeslaCam folder</v-card-title>
        <v-card-text>The folder selected should have the <em>RecentClips</em> and/or <em>SavedClips</em> subfolders</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="locateFolder">Manually Locate</v-btn>
          <v-btn @click="errors.locateFolder = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="confirm.saveManualFolder"
      max-width="420"
    >
      <v-card>
        <v-card-title>Save this folder?</v-card-title>
        <v-card-text>Confirm you want to automatically use this folder the next time you open TeslaCam Manager.</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="storeCurrentFolder">Save</v-btn>
          <v-btn @click="confirm.saveManualFolder = false">No</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="errors.delete"
      max-width="340"
    >
      <v-card>
        <v-card-title>Oops</v-card-title>
        <v-card-text>{{ errors.deleteMessage }}</v-card-text>
      </v-card>
    </v-dialog>

    <app-settings></app-settings>
  </v-app>
</template>

<script>
import AppSettings from '@/components/AppSettings.vue'
import DiskUsage from '@/components/DiskUsage.vue'
import VideoList from '@/components/VideoList.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import path from 'path'
import fs from 'fs'
import { getEndpointUrl } from '@/api'
import { shell } from 'electron'
const remote = require('@electron/remote')

export default {
  name: 'ManagerItem',

  components: {
    AppSettings,
    DiskUsage,
    VideoList,
    VideoPlayer
  },

  data() {
    return {
      isLoading: false,
      isSettingUp: false,
      isManualFolder: false,
      ffPaths: {},
      teslaCamDir: '', // eg. D:/TeslaCam
      teslaCamDrive: '', // eg. D:/
      recentVideosData: [],
      savedVideosData: [],
      diskUsageData: {},
      confirmDeleteAll: false,
      deletingVideo: '',
      confirm: {
        saveManualFolder: false
      },
      errors: {
        binaries: false,
        delete: false,
        deleteMessage: '',
        drive: false,
        data: false,
        manualFolder: false,
      },
      tab: this.$store.state.settings.defaultTab === 'recent' ? 0 : 1
    }
  },

  computed: {
    tabType() {
      return this.tab === 0
        ? 'recent'
        : 'saved';
    },

    tabTypeFolderName() {
      return this.tab === 0
        ? 'RecentClips'
        : 'SavedClips'
    },

    currentTabVideosData() {
      return this.tab === 0
        ? this.recentVideosData
        : this.savedVideosData;
    },

    currentlyPlayingVideosData() {
      const type = this.$store.state.current.type

      if (type === 'recent')
        return this.recentVideosData
      else if (type === 'saved')
        return this.savedVideosData

      return []
    },

    currentlyPlayingIdx() {
      let idx = this.currentlyPlayingVideosData.findIndex(vid =>
        vid.id === this.$store.state.current.id
      )

      return idx
    }
  },

  created() {
    // Retreive stored TeslaCam path data
    this.teslaCamDir = this.$store.state.settings.tcam.folder
    this.teslaCamDrive = this.$store.state.settings.tcam.drive

    // this.doSetup().then(this.getData)
    this.getData()
  },

  methods: {
    /**
     * @todo ffmpeg is not needed right now
     */
    // async doSetup() {
    //   let response
    //   this.isSettingUp = true
    //   this.errors.binaries = false

    //   try {
    //     response = await this.$http.get(getEndpointUrl('ffbinaries'))
    //     this.ffPaths = response.data
    //   } catch(e) {
    //     console.error(e)
    //     this.errors.binaries = true
    //     return
    //   }

    //   this.isSettingUp = false
    // },

    async getDriveStorage() {
      let response
      try {
        response = await this.$http.post(getEndpointUrl('teslacam/checkstorage'), {
          path: this.teslaCamDrive
        })

        this.diskUsageData = response.data
      } catch (e) {
        console.error(e)
        return
      }
    },

    clearData() {
      this.savedVideosData = []
      this.recentVideosData = []
    },

    async getData(refresh = false) {
      if (this.isSettingUp)
        return

      this.errors.drive = false

      // Use existing dir if not refreshed
      if (!this.teslaCamDir || (refresh && !this.isManualFolder)) {
        try {
          const response = await this.$http.get(getEndpointUrl('teslacam/scandrives'))
          this.teslaCamDir = response.data.dir
          this.teslaCamDrive = response.data.mnt

          if (!this.teslaCamDir) {
            this.errors.drive = true
            return
          }
        } catch(e) {
          console.error(e)
          this.errors.drive = true
          return
        }
      }

      const type = this.tabType
      const hasData = this.currentTabVideosData.length

      // Skip retrieving the same list if not manually refreshed
      if (hasData && !refresh)
        return

      this.isLoading = true

      try {
        const response = await this.$http.post(
          getEndpointUrl('teslacam/data'),
          { paths: { ...this.ffPaths, teslaCamDir: this.teslaCamDir }, type }
        )
        if (type === 'recent') {
          this.recentVideosData = response.data
        } else if (type === 'saved') {
          this.savedVideosData = response.data
        }

        if (this.currentTabVideosData.length) {
          this.$store.commit('SET_CURRENTLY_PLAYING', this.currentTabVideosData[0])
        }

      } catch(e) {
        console.error(e)
      }

      this.isLoading = false

      this.getDriveStorage()
    },

    postDelete() {
      if (this.tabType === 'recent')
        this.recentVideosData = []
      else if (this.tabType === 'saved')
        this.savedVideosData = []

      /**
       * Add a slight delay because getData fails in trying to read the files that were just deleted
       */
      setTimeout(() => this.getData(), 200)
    },

    async onDeleteAll() {
      // All videos that are not tagged
      const videos = [].concat.apply([],
        this.currentTabVideosData
          .filter(vid => !this.$store.state.taggedVideoIds.includes(vid.id))
          .map(vid => vid.videos)
        ).map(video => video.filepath)

      this.confirmDeleteAll = false
      this.isLoading = true
      this.errors.deleteMessage = ''

      this.$store.commit('UNSET_CURRENTLY_PLAYING')

      try {
        const response = await this.$http.post(
          getEndpointUrl('teslacam/delete'),
          {
            useTrash: this.$store.state.settings.trash,
            type: this.tabType,
            videos
          }
        )

        if (response.data.success) {
          this.postDelete()

          if (response.data.message) {
            this.errors.delete = true
            this.errors.deleteMessage = response.data.message
          }
        } else {
          this.errors.delete = true
          this.errors.deleteMessage = 'Something went wrong, try again.'
          this.isLoading = false
        }
      } catch (e) {
        console.error(e)
        this.errors.delete = true
        this.errors.deleteMessage = e.response.data.error
        this.isLoading = false
      }
    },

    onDelete(video) {
      this.deletingVideo = video.id
      let timeout = 0

      // If the video being deleted is being actively watched, stop first and wait a bit
      if (video.id === this.$store.state.current.id) {
        this.$store.commit('UNSET_CURRENTLY_PLAYING')
        timeout = 200
      }

      setTimeout(async () => {
        try {
          const response = await this.$http.post(
            getEndpointUrl('teslacam/delete'),
            {
              useTrash: this.$store.state.settings.trash,
              type: video.type,
              videos: video.videos.map(vid => vid.filepath)
            }
          )

          if (response.data.success) {
            this.postDelete()
          } else {
            this.errors.delete = true
          }

          this.deletingVideo = ''

        } catch(e) {
          console.error(e)
          this.errors.delete = true

          this.deletingVideo = ''
        }
      }, timeout)
    },

    onPlayNext() {
      let idx = this.currentlyPlayingIdx + 1

      if (!this.currentlyPlayingVideosData[idx]) {
        idx = 0
      }

      const data = this.currentlyPlayingVideosData[idx]
      data && this.$store.commit('SET_CURRENTLY_PLAYING', data)
    },

    onPlayPrev() {
      let idx = this.currentlyPlayingIdx - 1

      if (!this.currentlyPlayingVideosData[idx])
        idx = this.currentlyPlayingVideosData.length - 1

      const data = this.currentlyPlayingVideosData[idx]
      data && this.$store.commit('SET_CURRENTLY_PLAYING', data)
    },

    onTabChange() {
      setTimeout(() => {
        this.getData()
      }, 200)
    },

    openFolder() {
     shell.openExternal(
        path.join(
          'file://',
          this.teslaCamDir,
          this.tabType === 'recent' ? 'RecentClips' : 'SavedClips'
        )
      )
    },

    locateFolder() {
      try {
        // Show dialog to select the folder
        const result = remote.dialog.showOpenDialog(null, {
          title: 'Select the TeslaCam folder',
          properties: ['openDirectory']
        })
        const tcamPath = result && result[0]

        if (!tcamPath)
          return

        // Verify the folder
        const files = fs.readdirSync(result[0])
        let hasRecentOrSaved = false
        files.forEach(file => {
          if (fs.lstatSync(path.join(tcamPath, file)).isDirectory() &&
            file === 'RecentClips' || file === 'SavedClips')
            hasRecentOrSaved = true
        })

        if (hasRecentOrSaved) {
          this.errors.drive = this.errors.locateFolder = false
          this.teslaCamDir = tcamPath
          this.teslaCamDrive = path.parse(tcamPath).root
          this.isManualFolder = true

          this.clearData()
          this.getData()

          this.confirm.saveManualFolder = true
        } else {
          this.errors.drive = false
          this.errors.locateFolder = true
        }
      } catch (e) {
        this.errors.drive = false
        this.errors.locateFolder = true
      }
    },

    storeCurrentFolder() {
      this.confirm.saveManualFolder = false

      this.$store.commit('SET_TCAM_FOLDER', {
        path: this.teslaCamDir,
        drive: this.teslaCamDrive
      })
    }
  },
}
</script>

<style>
.progress-loader {
  margin-top: 20px;
}
</style>
