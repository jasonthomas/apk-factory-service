# APK Factory Service's Architecture

![](https://www.lucidchart.com/publicSegments/view/52a11164-ae24-4e2d-83fb-3fba0a004254/image.png)

This service processes HTTP requests directly from the following clients:
* Firefox for Android
* Developers using a CLI

This traffic may indirectly come from the Marketplace, via a daily update check, or directly from user action.

A load balancer will hand traffic to an nginx web server which will proxy traffic to our controller deamon.
There can be N controller deamons active, to scale the service horizontally.

## Install APK

The controller will check the APK Cache to see if it already has built the APK.
If so, it is directly returned to the client.

If not, the OWA Downloader retrieves some or all of the following:
* OWA Manifest
* OWA Packaged App (zip file)
* OWA Icons

These requests are made through an HTTP caching layer (Squid reverse proxy).
These requests would go to any place an OWA is hosted, such as:
* our Marketplace
* another Marketplace
* a application's website

These results are sent via a multipart HTTP Post to the Generator web service.
This work request goes through a load balancer layer, so that N Generator deamons
can be run.

The Generator ensures that an Android Certificate is available for the appliation.
If it doesn't have one, one is auto-generated.

A skeleton APK Project is created on disk.

Inputs are modified from OWA to Android standards.

Inputs are written to disk and used to fill in the APK Project template.

ant is invoked with some arugments and uses files on disk to build and sign the APK.

The resulting APK is sent in the HTTP response to the Controller.
The working build directory is removed.

The Controller updates the APK Cache with the APK file.
Finally, the APK File is returned to the client.

## Updated Versions Check

A second core web service API is a way for clients to provide a list of OWA Manifests paired
with version numbers. The list of all installed apps is sent in a JSON encoded HTTP POST.
The service uses the OWA Downloader, the APK Cache and a database of APK Metadata to
determine the list of APKs which have newer versions.

Metadata stored in the APK Metadata DB:
* manifest url
* digest of manifest contents
* digest of packaged app (optional)
* version number
* library version number
* current library version number

version number is an arbitrary (controlled by the APK Factory Service) incrementing integer.
It's really important that we don't lose the version number.

library version number tracks the Apk Factory Library, the Java support code for APKs.
If that version is bumped (say for an important security patch) this will cause
existing APKs to seem  out of date.

If any of the digests or library version numbers are out of date,
then the service responds with that app's manifest url in its output.

The client can then make a subsequent Install APK request.

## Build APK for Developer

A developer will `npm install apk-service-factory` and then do a
command line build of an APK.

TBD - this can be architected in at least 2 ways:

1. CLI code runs OWA Downloader code and POSTS to the review instance to a special CLI build API
2. CLI depends on ant and Android SDK. Portions of the server side codebase have CLI alternatives which all run locally. This can be used "offline".

## Implementation Details

Notes for background on why the current architecure exists.

OWA Versions aren't regulated in any way, so they aren't very useful to us.

A request for an APK Install blocks on a per-manifest basis.
So 4 concurrent requests will be queued up with the first request
obtaining a lock and either returning a cached APK or doing the
build. The 3 subsequent calls should should use the cache and return quickly.
This lock in at the controller deamon, so N controller deamons will
cause several concurrent writes to the S3 App Cache, which shouldn't be
an issue. The main reason is to avoid concurrency issues in the ant build.
