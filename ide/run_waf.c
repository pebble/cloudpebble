#include <sys/types.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/resource.h>

// We can't easily get at our settings, so these are just hardcoded.
#define BUILD_JAIL "/home/cloudpebble/jail/"
#define error(message) error_f(__FILE__, __LINE__, message)
#define require(call) if(error(call)) return errno;

_Bool error_f(char* file, int line, int ret) {
    if(ret == -1) {
        printf("%s:%d: error: %s\n", file, line, strerror(errno));
        return 1;
    }
    return 0;
}

int set_limit(int resource, rlim_t value) {
    return setrlimit(resource, &(const struct rlimit){.rlim_cur = value, .rlim_max = value});
}

int main(int argc, char** argv) {
    if(argc != 2) {
        printf("Requires one argument.\n");
        return 0;
    }
    uid_t start_uid = getuid();
    if(start_uid == 0) {
        printf("Corwardly refusing to run as root.\n");
        return 1;
    }
    require(setuid(0));
    require(chdir(BUILD_JAIL));
    require(chroot(BUILD_JAIL));
    require(setuid(start_uid));
    // We should now have no privileges and be jailed.
    // Impose some more limits:
    require(set_limit(RLIMIT_CPU, 10)); // Ten seconds
    require(set_limit(RLIMIT_NOFILE, 25)); // 25 open files
    require(set_limit(RLIMIT_RSS, 10 * 1024 * 1024)); // 10 MB of memory
    require(set_limit(RLIMIT_FSIZE, 1 * 1024 * 1024)); // 1 MB output files
    // Actually do the build.
    require(chdir(argv[1]));
    require(setenv("PATH", "/bin:/usr/bin:/sdk/arm-cs-tools/bin", 1));
    require(setenv("HOME", "/", 1));

    int success = system("./waf configure");
    if(success != 0) {
        return WEXITSTATUS(success);
    }
    success = system("./waf build");
    if(success != 0) {
        return WEXITSTATUS(success);
    }
    return 0;
}
