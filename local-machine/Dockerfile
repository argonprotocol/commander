FROM jrei/systemd-ubuntu:25.04

RUN sed -i 's/noble/plucky/g' /etc/apt/sources.list.d/ubuntu.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends openssh-server sudo ufw netcat-openbsd

RUN mkdir -p /run/sshd
# disable policy-rc.d to allow service start
RUN rm -f /usr/sbin/policy-rc.d && \
    systemctl mask getty@tty1.service

# Update sshd_config
RUN sed -i 's/#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#\?UsePAM.*/UsePAM yes/' /etc/ssh/sshd_config && \
    echo "AllowUsers root" >> /etc/ssh/sshd_config && \
    echo "ClientAliveInterval 120" >> /etc/ssh/sshd_config && \
    sed -i '/pam_nologin.so/d' /etc/pam.d/sshd

RUN systemctl enable ssh

EXPOSE 22
CMD ["/lib/systemd/systemd"]
