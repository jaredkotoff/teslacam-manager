const drivelist = require('drivelist')
const fs = require('fs')
const path = require('path')
const ffprobe = require('ffprobe')
const { downloadBinaries, detectPlatform } = require('ffbinaries')
const { app } = require('electron')

/**
 * @param {String} filename '2019-06-29_15-29-28-front.mp4'
 * @returns {Object} { date, timestamp, camera }
 */
function parseFilename(filename) {
  filename = filename.substring(0, filename.indexOf('.'))
  let [ date, timeLocation ] = filename.split('_')
  let [ camera ] = timeLocation.match(/[a-zA-Z]+/)
  let time = timeLocation.substring(0, timeLocation.indexOf('-' + camera))
  time = time.replace(/-/g, ':')
  let timestamp = (date + ' ' + time)

  return {
    date,
    timestamp,
    camera
  }
}

export const isTeslaCamVideoFilepath = (filepath) => {
  return filepath.includes('TeslaCam') && filepath.endsWith('mp4')
}

/**
 * Scans user's drives to auto-detect TeslaCam directory
 * @todo Multiple drives detection
 */
export const scanDrives = () => {
  return new Promise((resolve, reject) => {
    drivelist.list()
      .then(drives => {
        let tcamDir = ''

        drives.forEach(drive => {
          drive.mountpoints.forEach(mountpoint => {
            if (fs.existsSync(path.join(mountpoint.path, 'TeslaCam')))
              tcamDir = path.join(mountpoint.path, 'TeslaCam')
          })
        })

        resolve({
          dir: tcamDir,
          drives
        })
      })
      .catch(err => {
        reject(err)
      })
  })
}

/**
 * Downloads/adds ffprobe/ffmpeg binaries to user's temp folder
 * Retrieves from cache if already detected
 * @returns {Promise}
 */
export const getBinaries = () => {
  return new Promise((resolve, reject) => {
    const platform = detectPlatform()
    const ffPaths = {
      ffprobe: '',
      ffmpeg: ''
    };

    downloadBinaries(
      ['ffprobe', 'ffmpeg'],
      { destination: app.getPath('temp') },
      (err, data) => {
        if (err) {
          return reject(err)
        }

        const ffprobe = data.find(d => d.filename === 'ffprobe')
        const ffmpeg = data.find(d => d.filename === 'ffmpeg')

        ffPaths.ffprobe = path.join(
          ffprobe.path,
          ffprobe.filename + (platform.includes('win-') ? '.exe' : '')
        )
        ffPaths.ffmpeg = path.join(
          ffmpeg.path,
          ffmpeg.filename + (platform.includes('win-') ? '.exe' : '')
        )

        resolve(ffPaths)
      })
  })
}

/**
 * Get video data
 * @param {Object} paths Path to ff binaries and teslacam dir
 * @param {String} type 'recent' or 'saved'
 */
export const getData = (paths = {}, type = 'recent') => {
  let videosPath = paths.teslaCamDir

  if (type === 'recent')
    videosPath += path.sep + 'RecentClips'
  else if (type === 'saved')
    videosPath += path.sep + 'SavedClips'

  const filenames = fs.readdirSync(videosPath)
  const videos = filenames.map(filename => {
    let { date, timestamp, camera } = parseFilename(filename)
    const filepath = `${videosPath}${path.sep}${filename}`
    const stats = fs.statSync(filepath)
    const size = parseInt(stats.size / 1000000)

    return {
      camera,
      date,
      filepath,
      id: filename,
      timestamp,
      sizeInMegabytes: size
    }
  })

  const videosMap = {}

  const probes = videos.map(video => {
    return new Promise((res) => {
      ffprobe(video.filepath, { path: paths.ffprobe })
        .then(info => {
          video.duration = info.streams[0].duration
          video.codec = info.streams[0].codec_name
          res(video)
        })
        .catch((e) => {
          video.error = e
          res(video)
        })
    })
  })

  return Promise.all(probes).then(videos => {
    videos.forEach(video => {
      if (!videosMap[video.timestamp]) {
        videosMap[video.timestamp] = {
          videos: [],
          duration: video.duration,
          sizeInMegabytes: video.sizeInMegabytes
        }
      } else {
        videosMap[video.timestamp].sizeInMegabytes += video.sizeInMegabytes
      }

      videosMap[video.timestamp].videos.push(video)
    })

    return videosMap
  })
}