FROM ubuntu:24.10

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssh-server && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /run/sshd

# make a mock .ssh directory
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh

COPY dev.ssh_key.pub /root/.ssh/authorized_keys

# Update sshd_config
RUN sed -i 's/#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]